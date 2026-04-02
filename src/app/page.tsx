import Link from 'next/link';

export default function WelcomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-4 pt-8">
        {/* Monogram */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border-[1.5px] border-secondary">
          <span className="font-serif text-[22px] text-secondary">M&J</span>
        </div>

        <h1 className="text-center font-serif text-[26px] font-medium leading-tight">
          Malachie & Jessica
        </h1>
        <p className="mt-1 text-[13px] tracking-wide text-secondary">
          23 mai 2026 &middot; Nantes
        </p>

        <div className="my-6 h-px w-8 bg-secondary/50" />

        <p className="font-serif text-lg">Regards</p>
        <p className="mt-2 max-w-[280px] text-center text-sm leading-relaxed text-text-secondary">
          Vivez le mariage à travers les yeux de chacun. Partagez vos photos,
          relevez des défis, et découvrez la journée sous tous les angles.
        </p>
      </div>

      <div className="px-6 pb-6">
        <Link
          href="/join"
          className="block w-full rounded-lg bg-primary py-3.5 text-center text-[15px] font-medium text-white"
        >
          Rejoindre le mariage
        </Link>
        <p className="mt-2.5 text-center text-[11px] text-text-tertiary">
          Aucun compte &middot; Aucune app à télécharger
        </p>
      </div>
    </div>
  );
}