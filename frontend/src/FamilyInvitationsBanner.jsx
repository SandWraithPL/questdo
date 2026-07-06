// Importy React i bibliotek
import { useState, useEffect } from "react";
import axios from "axios";

// Komponent wyświetlający zaproszenia do rodzin
export default function FamilyInvitationsBanner({ api, headers, onToast, onFamilyChange }) {
  // Lista otrzymanych zaproszeń do rodzin
  const [invitations, setInvitations] = useState([]);

  // Ładuje listę zaproszeń z backendu
  const loadInvitations = async () => {
    try {
      // Pobieramy zaproszenia z API
      const res = await axios.get(`${api}/family/invitations`, { headers });
      setInvitations(res.data);
    } catch (err) {
      // Cicho ignorujemy błędy przy ładowaniu
    }
  };

  // Przy mountowaniu: ładujemy zaproszenia co minutę
  useEffect(() => {
    loadInvitations();
    const interval = setInterval(loadInvitations, 60000);
    return () => clearInterval(interval);
  }, [api, headers]);

  // Obsługuje akceptację zaproszenia do rodziny
  const acceptInvitation = async (invitationId) => {
    try {
      // Wysyłamy POST do zaakceptowania zaproszenia
      await axios.post(`${api}/family/invitations/${invitationId}/accept`, {}, { headers });
      // Ładujemy nową listę zaproszeń
      await loadInvitations();
      onToast("✅ Dołączyłeś do rodziny");
      // Informujemy rodzica że dane rodziny się zmieniły
      onFamilyChange?.();
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd akceptacji");
    }
  };

  // Obsługuje odrzucenie zaproszenia do rodziny
  const declineInvitation = async (invitationId) => {
    try {
      // Wysyłamy POST do odrzucenia zaproszenia
      await axios.post(`${api}/family/invitations/${invitationId}/decline`, {}, { headers });
      // Ładujemy nową listę zaproszeń
      await loadInvitations();
      onToast("❌ Odrzucono zaproszenie");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd odrzucenia");
    }
  };

  // Jeśli brak zaproszeń, nie wyświetlamy komponentu
  if (invitations.length === 0) return null;

  return (
    <section className="family-invitations-banner">
      <div className="invitations-header">
        <span className="invitations-title">👨‍👩‍👧‍👦 Zaproszenia do rodziny</span>
        <span className="invitations-count">{invitations.length}</span>
      </div>
      <div className="invitations-list">
        {invitations.map((inv) => (
          <div key={inv.id} className="invitation-card-banner">
            <div className="invitation-info-banner">
              <span className="invitation-family-banner">{inv.family_name}</span>
              <span className="invitation-from-banner">od: {inv.invited_by}</span>
            </div>
            <div className="invitation-actions-banner">
              <button
                type="button"
                className="accept-btn"
                onClick={() => acceptInvitation(inv.id)}
              >
                Akceptuj
              </button>
              <button
                type="button"
                className="decline-btn"
                onClick={() => declineInvitation(inv.id)}
              >
                Odrzuć
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
