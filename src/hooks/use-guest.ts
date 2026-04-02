'use client';

import { useState, useEffect } from 'react';

export function useGuest() {
  const [guestId, setGuestId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(null);

  useEffect(() => {
    setGuestId(localStorage.getItem('guest_id'));
    setGuestName(localStorage.getItem('guest_name'));
  }, []);

  return { guestId, guestName };
}