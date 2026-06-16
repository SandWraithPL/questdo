import { useState, useEffect } from "react";
import axios from "axios";

export default function FamilyPanel({ api, headers, onToast, onFamilyChange }) {
  const [families, setFamilies] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [selectedFamily, setSelectedFamily] = useState(null);

  const loadFamilies = async () => {
    try {
      const res = await axios.get(`${api}/families`, { headers });
      setFamilies(res.data);
      if (res.data.length > 0 && !selectedFamily) {
        setSelectedFamily(res.data[0]);
      }
    } catch (err) {
      console.error("Błąd ładowania rodzin:", err);
    }
  };

  const loadInvitations = async () => {
    try {
      const res = await axios.get(`${api}/family/invitations`, { headers });
      setInvitations(res.data);
    } catch (err) {
      console.error("Błąd ładowania zaproszeń:", err);
    }
  };

  useEffect(() => {
    loadFamilies();
    loadInvitations();
  }, []);

  // Poll for new invitations every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadInvitations();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const createFamily = async () => {
    if (!familyName.trim()) {
      onToast("Podaj nazwę rodziny");
      return;
    }
    try {
      await axios.post(`${api}/families`, { name: familyName }, { headers });
      setFamilyName("");
      setShowCreate(false);
      await loadFamilies();
      onToast("👨‍👩‍👧‍👦 Utworzono rodzinę");
    } catch (err) {
      onToast(err.response?.data?.detail || "Błąd tworzenia rodziny");
    }
  };

  const inviteUser = async () => {
    if (!inviteUsername.trim()) {
      onToast("Podaj nazwę użytkownika");
      return;
    }
    if (!selectedFamily) {
      onToast("Wybierz rodzinę");
      return;
    }
    try {
      console.log("Inviting user:", inviteUsername, "to family:", selectedFamily.id);
      const res = await axios.post(`${api}/families/${selectedFamily.id}/invite`,
        { username: inviteUsername }, { headers });
      console.log("Invite response:", res.data);
      setInviteUsername("");
      setShowInvite(false);
      onToast("📧 Wysłano zaproszenie");
    } catch (err) {
      console.error("Invite error:", err);
      console.error("Error response:", err.response?.data);
      onToast(err.response?.data?.detail || "Błąd wysyłania zaproszenia");
    }
  };

  const acceptInvitation = async (invitationId) => {
    try {
      await axios.post(`${api}/family/invitations/${invitationId}/accept`, {}, { headers });
      await loadInvitations();
      await loadFamilies();
      onToast("✅ Dołączyłeś do rodziny");
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

  const leaveFamily = async (familyId) => {
    try {
      await axios.post(`${api}/families/${familyId}/leave`, {}, { headers });
      await loadFamilies();
      if (selectedFamily?.id === familyId) {
        setSelectedFamily(null);
      }
      onToast("👋 Opuściłeś rodzinę");
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes("jedynym administratorem")) {
        // If user is the only admin, delete the family instead
        if (window.confirm("Jesteś jedynym administratorem. Czy chcesz usunąć rodzinę?")) {
          try {
            await axios.delete(`${api}/families/${familyId}`, { headers });
            await loadFamilies();
            if (selectedFamily?.id === familyId) {
              setSelectedFamily(null);
            }
            onToast("🗑️ Rodzina została usunięta");
          } catch (deleteErr) {
            onToast(deleteErr.response?.data?.detail || "Błąd usuwania rodziny");
          }
        }
      } else {
        onToast(err.response?.data?.detail || "Błąd opuszczania rodziny");
      }
    }
  };

  const selectFamily = (family) => {
    setSelectedFamily(family);
    onFamilyChange(family.id);
  };

  return (
    <div className="module-panel family-panel">
      <h3>👨‍👩‍👧‍👦 Rodzina</h3>

      {/* Oczekujące zaproszenia */}
      {invitations.length > 0 && (
        <div className="invitations-section">
          <h4>Oczekujące zaproszenia ({invitations.length})</h4>
          {invitations.map((inv) => (
            <div key={inv.id} className="invitation-card">
              <div className="invitation-info">
                <span className="invitation-family">{inv.family_name}</span>
                <span className="invitation-from">od: {inv.invited_by}</span>
              </div>
              <div className="invitation-actions">
                <button type="button" className="icon-btn" onClick={() => acceptInvitation(inv.id)} title="Akceptuj">✅</button>
                <button type="button" className="icon-btn delete" onClick={() => declineInvitation(inv.id)} title="Odrzuć">❌</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {families.length === 0 ? (
        <div className="no-family">
          <p>Nie należysz do żadnej rodziny</p>
          {!showCreate ? (
            <button type="button" className="add-task-btn" onClick={() => setShowCreate(true)}>+ Utwórz rodzinę</button>
          ) : (
            <div className="add-task">
              <h3>➕ Utwórz nową rodzinę</h3>
              <input 
                type="text"
                className="search-input"
                placeholder="Nazwa rodziny" 
                value={familyName} 
                onChange={(e) => setFamilyName(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && createFamily()}
              />
              <div className="row" style={{ marginTop: 12 }}>
                <button type="button" className="add-task-btn" onClick={createFamily}>Utwórz</button>
                <button type="button" className="cancel-btn" onClick={() => setShowCreate(false)}>Anuluj</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="families-list">
          <div className="family-selector">
            <label>Wybierz rodzinę:</label>
            <select 
              value={selectedFamily?.id || ""} 
              onChange={(e) => {
                const family = families.find(f => f.id === parseInt(e.target.value));
                if (family) selectFamily(family);
              }}
              className="rate-dropdown"
              style={{ width: "100%" }}
            >
              {families.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          {selectedFamily && (
            <div className="family-details">
              <div className="family-header">
                <h4>{selectedFamily.name}</h4>
                <span className="family-role">
                  {selectedFamily.role === "admin" ? "👑 Administrator" : "👤 Członek"}
                </span>
              </div>

              <div className="family-members">
                <h5>Członkowie ({selectedFamily.members.length})</h5>
                {selectedFamily.members.map((member) => (
                  <div key={member.id} className="member-item">
                    <span className="member-name">{member.username}</span>
                    <span className="member-role">
                      {member.role === "admin" ? "👑" : "👤"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="family-actions">
                {selectedFamily.role === "admin" && (
                  <button type="button" className="add-task-btn" onClick={() => setShowInvite(!showInvite)} style={{ marginBottom: 8 }}>
                    📧 Zaproś członka
                  </button>
                )}
                <button type="button" className="danger-btn" onClick={() => leaveFamily(selectedFamily.id)}>
                  👋 Opuść rodzinę
                </button>
              </div>

              {showInvite && selectedFamily.role === "admin" && (
                <div className="add-task" style={{ marginTop: 12, padding: 16 }}>
                  <h3>📧 Zaproś użytkownika</h3>
                  <input 
                    type="text"
                    className="search-input"
                    placeholder="Nazwa użytkownika" 
                    value={inviteUsername} 
                    onChange={(e) => setInviteUsername(e.target.value)} 
                    onKeyDown={(e) => e.key === "Enter" && inviteUser()}
                  />
                  <div className="row" style={{ marginTop: 12 }}>
                    <button type="button" className="add-task-btn" onClick={inviteUser}>Wyślij zaproszenie</button>
                    <button type="button" className="cancel-btn" onClick={() => setShowInvite(false)}>Anuluj</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}