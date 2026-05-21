'use client';

import { useState, useEffect, useRef } from 'react';

type Comment = {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  guest: { name: string } | null;
};

export default function CommentThread({ mediaId }: { mediaId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const reqId = useRef(0);

  // Guard against out-of-order responses: only the most recent fetch wins.
  async function loadComments() {
    const myReq = ++reqId.current;
    const res = await fetch(`/api/media/${mediaId}/comments`);
    if (res.ok && myReq === reqId.current) {
      setComments(await res.json());
    }
  }

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    const res = await fetch(`/api/media/${mediaId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment.trim() }),
    });

    if (res.ok) {
      setNewComment('');
      await loadComments();
    }
    setSubmitting(false);
  }

  return (
    <div>
      <div className="max-h-60 space-y-3 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.id} className={`${c.parentId ? 'ml-8' : ''}`}>
            <p className="text-[13px]">
              <span className="font-medium">{c.guest?.name}</span>{' '}
              <span className="text-text-secondary">{c.content}</span>
            </p>
            <p className="text-[10px] text-text-tertiary">
              {new Date(c.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Ajouter un commentaire..."
          className="flex-1 rounded-full border border-border bg-white px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!newComment.trim() || submitting}
          className="rounded-full bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
