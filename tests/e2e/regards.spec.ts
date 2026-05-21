import { test, expect, type Page } from '@playwright/test';

// A tiny but valid 1x1 PNG — enough for the upload + sharp processing pipeline.
const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// A minimal ISO-BMFF `ftyp` box. ffmpeg cannot derive a frame from it, which is
// exactly the point: the test asserts the video path degrades gracefully.
const SAMPLE_MP4 = Buffer.from([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x01,
  0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x32,
]);

const ADMIN_PASSWORD = 'admin-change-me';

test.describe.serial('Parcours invité Regards', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page.close();
  });

  test('Accueil → inscription invité → feed', async () => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Malachie & Jessica' })).toBeVisible();
    await page.getByRole('link', { name: 'Rejoindre le mariage' }).click();

    await expect(page).toHaveURL(/\/join/);
    await page.getByPlaceholder('Ex: Sophie').fill('Sophie E2E');
    await page.getByRole('button', { name: 'Ami(e) de la mariée' }).click();
    await page.getByRole('button', { name: "C'est parti !" }).click();

    await expect(page).toHaveURL(/\/feed/);
    await expect(page.getByRole('heading', { name: 'Regards' })).toBeVisible();
  });

  test('Upload d’une photo → apparaît dans le feed', async () => {
    await page.goto('/upload');
    await page.locator('input[type="file"]').nth(1).setInputFiles({
      name: 'souvenir.png',
      mimeType: 'image/png',
      buffer: SAMPLE_PNG,
    });

    await page.getByRole('button', { name: /Envoyer 1 fichier/ }).click();
    await expect(page).toHaveURL(/\/feed/, { timeout: 30_000 });

    // Processing (thumbnail/EXIF) is async — poll the API until the media is ready.
    await expect
      .poll(
        async () => {
          const res = await page.request.get('/api/media');
          const json = await res.json();
          return json.feed?.length ?? 0;
        },
        { timeout: 45_000, intervals: [1000, 2000, 2000, 3000] }
      )
      .toBeGreaterThan(0);

    await page.goto('/feed');
    await expect(page.getByTestId('media-card').first()).toBeVisible();
  });

  test('Réaction (cœur) — incrémente et persiste après rechargement', async () => {
    const card = page.getByTestId('media-card').first();
    await expect(card.getByTestId('reaction-count')).toHaveText('0');

    const reactionPosted = page.waitForResponse(
      (r) => r.url().includes('/reactions') && r.request().method() === 'POST'
    );
    await card.getByTestId('reaction-button').click();
    await reactionPosted;
    await expect(card.getByTestId('reaction-count')).toHaveText('1');

    await page.reload();
    await expect(
      page.getByTestId('media-card').first().getByTestId('reaction-count')
    ).toHaveText('1');
  });

  test('Commentaire — ajout et compteur dans le feed', async () => {
    await page.getByTestId('media-card').first().locator('img').click();
    await expect(page).toHaveURL(/\/media\//);

    await page.getByPlaceholder('Ajouter un commentaire...').fill('Magnifique souvenir !');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText('Magnifique souvenir !')).toBeVisible();

    await page.goto('/feed');
    await expect(
      page.getByTestId('media-card').first().getByTestId('comment-count')
    ).toHaveText('1');
  });

  test('Défis — au moins les 10 défis du seed', async () => {
    await page.goto('/challenges');
    await expect(page.getByRole('heading', { name: 'Défis photo' })).toBeVisible();
    await expect(page.getByTestId('challenge-card').first()).toBeVisible();
    expect(await page.getByTestId('challenge-card').count()).toBeGreaterThanOrEqual(10);
  });

  test('Moments — timeline des moments du seed', async () => {
    await page.goto('/moments');
    await expect(page.getByRole('heading', { name: 'Moments' })).toBeVisible();
    await expect(page.getByTestId('moment-node').first()).toBeVisible();
    expect(await page.getByTestId('moment-node').count()).toBeGreaterThanOrEqual(5);
  });

  test('Classement — stats et photographe présent', async () => {
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { name: 'Classement' })).toBeVisible();
    await expect(page.getByText('Top photographes')).toBeVisible();
    await expect(page.getByText('Sophie E2E').first()).toBeVisible();
  });

  test('Livre d’or audio — enregistrement et envoi', async () => {
    await page.goto('/guestbook');
    await expect(page.getByRole('heading', { name: /Livre d.or sonore/ })).toBeVisible();

    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: 'Arrêter' }).click();

    await expect(page.getByRole('button', { name: /Envoyer aux mariés/ })).toBeVisible();
    await page.getByRole('button', { name: /Envoyer aux mariés/ }).click();

    await expect(page.getByText('1 message', { exact: true })).toBeVisible();
    await expect(page.locator('audio')).toHaveCount(1);
  });

  test('Diaporama live — affiche la photo uploadée', async () => {
    await page.goto('/slideshow');
    await expect(page.getByText('Malachie & Jessica')).toBeVisible();
    await expect(page.locator('img[src^="/api/media/file/"]')).toBeVisible({ timeout: 20_000 });
  });

  test('Upload vidéo — pipeline résilient et affichage feed', async () => {
    await page.goto('/upload');
    await page.locator('input[type="file"]').nth(1).setInputFiles({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: SAMPLE_MP4,
    });
    await page.getByRole('button', { name: /Envoyer 1 fichier/ }).click();
    await expect(page).toHaveURL(/\/feed/, { timeout: 30_000 });

    // The video must reach the feed even when thumbnailing degrades — proves
    // the async ffmpeg path never crashes or stalls the processing pipeline.
    await expect
      .poll(
        async () => {
          const res = await page.request.get('/api/media');
          const json = await res.json();
          let count = 0;
          for (const f of json.feed ?? []) {
            count += f.type === 'cluster' ? f.items.length : 1;
          }
          return count;
        },
        { timeout: 45_000, intervals: [1000, 2000, 2000, 3000] }
      )
      .toBeGreaterThanOrEqual(2);
  });
});

test.describe.serial('Parcours admin Regards', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    page.on('dialog', (d) => d.accept());
  });
  test.afterAll(async () => {
    await page.close();
  });

  test('Connexion admin protégée', async () => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.getByPlaceholder('Mot de passe').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Accéder' }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible();
  });

  test('Admin défis — création puis suppression', async () => {
    await page.goto('/admin/challenges');
    await page.getByPlaceholder('Titre').fill('Défi E2E');
    await page.getByPlaceholder('Description').fill('Créé par le test automatisé');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByText('Défi E2E')).toBeVisible();

    const row = page.locator('div.rounded-card.border', { hasText: 'Défi E2E' });
    await row.getByRole('button', { name: 'Suppr.' }).click();
    await expect(page.getByText('Défi E2E')).toHaveCount(0);
  });

  test('Admin moments — création', async () => {
    await page.goto('/admin/moments');
    await page.getByPlaceholder('Label (ex. Cérémonie)').fill('Moment E2E');
    await page.locator('input[type="datetime-local"]').nth(0).fill('2026-05-23T10:00');
    await page.locator('input[type="datetime-local"]').nth(1).fill('2026-05-23T11:00');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByText('Moment E2E')).toBeVisible();
  });

  test('Admin modération — la photo uploadée est listée', async () => {
    await page.goto('/admin/media');
    await expect(page.getByRole('heading', { name: /Modération des médias/ })).toBeVisible();
    await expect(page.locator('img[src^="/api/media/file/"]').first()).toBeVisible();
  });

  test('Admin dashboard — QR code et export ZIP', async () => {
    await page.goto('/admin');
    await expect(page.getByText('QR code invités')).toBeVisible();
    await expect(page.getByRole('link', { name: /album complet/i })).toBeVisible();

    const zip = await page.request.get('/api/admin/export');
    expect(zip.status()).toBe(200);
    expect(zip.headers()['content-type']).toContain('zip');
  });
});
