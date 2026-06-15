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
      await axios.post(`${api}/families/${selectedFamily.id}/invite`, 
        { username: inviteUsername }, { headers });
      setInviteUsername("");
      setShowInvite(false);
      onToast("📧 Wysłano zaproszenie");
    } catch (err) {
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
      onToast(err.response?.data?.detail || "Błąd opuszczania rodziny");
    }
  };

  const selectFamily = (family) => {
    setSelectedFamily(family);
    onFamilyChange(family.id);
  };

  return (
    <div className="module-panel family-panel">
      <h3>👨‍👩‍👧‍👦 Rodzina</h3>

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
            <div className="create-family-form">
              <input 
                placeholder="Nazwa rodziny" 
                value={familyName} 
                onChange={(e) => setFamilyName(e.target.value)} 
              />
              <div className="row">
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

              {selectedFamily.role === "admin" && (
                <div className="family-actions">
                  <button type="button" className="icon-btn history-btn" onClick={() => setShowInvite(!showInvite)}>
                    📧 Zaproś członka
                  </button>
                  <button type="button" className="danger-btn" onClick={() => leaveFamily(selectedFamily.id)}>
                    👋 Opuść rodzinę
                  </button>
                </div>
              )}

              {showInvite && selectedFamily.role === "admin" && (
                <div className="invite-form">
                  <input 
                    placeholder="Nazwa użytkownika" 
                    value={inviteUsername} 
                    onChange={(e) => setInviteUsername(e.target.value)} 
                  />
                  <div className="row">
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