import { useState, useEffect } from "react";
import axios from "axios";

export default function FamilyInvitationsBanner({ api, headers, onToast, onFamilyChange }) {
  const [invitations, setInvitations] = useState([]);

  const loadInvitations = async () => {
    try {
      const res = await axios.get(`${api}/family/invitations`, { headers });
      setInvitations(res.data);
    } catch (err) {
      console.error("Błąd ładowania zaproszeń:", err);
    }
  };

  useEffect(() => {
    loadInvitations();
  }, [api, headers]);

  // Poll for new invitations every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadInvitations();
    }, 30000);
    return () => clearInterval(interval);
  }, [api, headers]);

  const acceptInvitation = async (invitationId) => {
    try {
      await axios.post(`${api}/family/invitations/${invitationId}/accept`, {}, { headers });
      await loadInvitations();
      onToast("✅ Dołączyłeś do rodziny");
      if (onFamilyChange) {
        onFamilyChange();
      }
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd akceptacji");
    }
  };

  const declineInvitation = async (invitationId) => {
    try {
      await axios.post(`${api}/family/invitations/${invitationId}/decline`, {}, { headers });
      await loadInvitations();
      onToast("❌ Odrzucono zaproszenie");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd odrzucenia");
    }
  };

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
