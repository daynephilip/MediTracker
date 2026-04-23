import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons for Leaflet + bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const userIcon = new L.DivIcon({
  html: '<div style="width:16px;height:16px;background:#1DB9A6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>',
  className: '', iconSize: [16, 16], iconAnchor: [8, 8]
});

const pharmacyIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

function RecenterMap({ lat, lng }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], 15); }, [lat, lng, map]);
  return null;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newMed, setNewMed] = useState({ name: '', dosage: '', frequency: '', time: '', doses_available: 0, start_date: '', recurrence: 'none' });
  const [editingMedId, setEditingMedId] = useState(null);

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const fileRef = useRef(null);

  // Chat image state
  const [chatImage, setChatImage] = useState(null);
  const [chatImagePreview, setChatImagePreview] = useState(null);
  const chatImageRef = useRef(null);

  // Profile state
  const [profile, setProfile] = useState({ name: '', age: 0, blood_group: '', allergies: '', notes: '' });
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', age: 0, blood_group: '', allergies: '', notes: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Map state
  const [userPos, setUserPos] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState(null);

  // Calendar state
  const todayRef = new Date();
  const [calYear, setCalYear] = useState(todayRef.getFullYear());
  const [calMonth, setCalMonth] = useState(todayRef.getMonth());
  const [selectedDay, setSelectedDay] = useState(todayRef.getDate());

  const fetchMeds = async () => {
    try {
      const res = await fetch('/api/medications', {
        headers: { 'Authorization': 'Bearer test_user_123' }
      });
      const data = await res.json();
      setMeds(data.medications || []);
    } catch (err) { console.error("Failed to fetch medications", err); }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile', { headers: { 'Authorization': 'Bearer test_user_123' } });
      const data = await res.json();
      setProfile(data);
      setProfileForm(data);
    } catch (err) { console.error('Failed to fetch profile', err); }
  };

  useEffect(() => { fetchMeds(); fetchProfile(); }, []);

  const handleSaveProfile = async () => {
    setProfileLoading(true);
    try {
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_user_123' },
        body: JSON.stringify(profileForm)
      });
      setProfile(profileForm);
      setEditingProfile(false);
    } catch (err) { console.error('Failed to save profile', err); }
    finally { setProfileLoading(false); }
  };

  const handleChatImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setChatImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setChatImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Fetch pharmacies when map tab opens
  useEffect(() => {
    if (activeTab !== 'map') return;
    setMapLoading(true);
    setMapError(null);
    if (!navigator.geolocation) {
      setMapError('Geolocation is not supported by your browser.');
      setMapLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserPos({ lat: latitude, lng: longitude });
        fetchPharmacies(latitude, longitude);
      },
      () => { setMapError('Location access denied. Please enable location services.'); setMapLoading(false); }
    );
  }, [activeTab]);

  const fetchPharmacies = async (lat, lng) => {
    try {
      const radius = 3000;
      const query = `[out:json][timeout:10];node["amenity"="pharmacy"](around:${radius},${lat},${lng});out body;`;
      const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
      const data = await res.json();
      const list = (data.elements || []).map(el => ({
        id: el.id,
        name: el.tags?.name || 'Pharmacy',
        lat: el.lat, lng: el.lon,
        address: el.tags?.['addr:street'] ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim() : '',
        hours: el.tags?.opening_hours || '',
        dist: haversine(lat, lng, el.lat, el.lon)
      })).sort((a, b) => a.dist - b.dist);
      setPharmacies(list);
    } catch (err) { setMapError('Failed to fetch nearby pharmacies.'); }
    finally { setMapLoading(false); }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() && !chatImage) return;
    const hasImage = !!chatImage;
    const userMsg = { role: 'user', content: chatInput || '[Image sent for identification]' };
    if (chatImagePreview) userMsg.image = chatImagePreview;
    setChatHistory(prev => [...prev, userMsg]);
    const msgText = chatInput;
    const imgFile = chatImage;
    setChatInput(''); setChatImage(null); setChatImagePreview(null); setLoading(true);
    try {
      let data;
      if (hasImage) {
        const formData = new FormData();
        formData.append('file', imgFile);
        formData.append('message', msgText);
        const res = await fetch('/api/chat/image', {
          method: 'POST', headers: { 'Authorization': 'Bearer test_user_123' }, body: formData
        });
        data = await res.json();
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_user_123' },
          body: JSON.stringify({ message: msgText })
        });
        data = await res.json();
      }
      setChatHistory(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch { setChatHistory(prev => [...prev, { role: 'assistant', content: "⚠️ Error connecting to server." }]); }
    finally { setLoading(false); }
  };

  const handleAddMedSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMedId) {
        await fetch(`/api/medications/${editingMedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_user_123' },
          body: JSON.stringify(newMed)
        });
      } else {
        await fetch('/api/medications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test_user_123' },
          body: JSON.stringify(newMed)
        });
      }
      setNewMed({ name: '', dosage: '', frequency: '', time: '', doses_available: 0, start_date: '', recurrence: 'none' });
      setEditingMedId(null);
      fetchMeds(); setActiveTab('home');
    } catch (err) { console.error("Failed to save medication", err); }
  };

  const handleDeleteMed = async (id) => {
    if (!window.confirm("Are you sure you want to delete this medication?")) return;
    try {
      await fetch(`/api/medications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer test_user_123' }
      });
      if (editingMedId === id) {
        setEditingMedId(null);
        setNewMed({ name: '', dosage: '', frequency: '', time: '', doses_available: 0, start_date: '', recurrence: 'none' });
        setActiveTab('home');
      }
      fetchMeds();
    } catch (err) { console.error("Failed to delete medication", err); }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setUploadMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleScanBottle = async () => {
    if (!uploadFile) return;
    setUploadLoading(true); setUploadMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await fetch('/api/upload_bottle', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test_user_123' },
        body: formData
      });
      const data = await res.json();
      if (data.error) {
        setUploadMsg({ type: 'error', text: data.error });
      } else {
        setNewMed(prev => ({ ...prev, name: data.name || prev.name, dosage: data.dosage || prev.dosage }));
        setUploadMsg({ type: 'success', text: `Detected: ${data.name} ${data.dosage}` });
      }
    } catch { setUploadMsg({ type: 'error', text: 'Failed to scan image. Please try again.' }); }
    finally { setUploadLoading(false); }
  };

  /* ── RENDER FUNCTIONS ── */

  const renderHome = () => (
    <div className="home-container">
      <div className="header-card">
        <div className="header-top">
          <div>
            <h1>Welcome<br/><strong>Denis H!</strong></h1>
            <p>Your Medication Safety Companion</p>
          </div>
          <button className="icon-btn" onClick={() => setActiveTab('add')} style={{background:'rgba(255,255,255,0.2)',color:'white'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
      <div className="content-area">
        <h2 className="section-title">My Medications</h2>
        <div className="categories-list" style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {meds.length === 0 ? (
            <div style={{padding:'20px',background:'#f5f5f5',borderRadius:'12px',textAlign:'center'}}>
              <p>No medications added yet.</p>
              <button onClick={() => setActiveTab('add')} style={{marginTop:'10px',padding:'8px 16px',background:'#1DB9A6',color:'white',border:'none',borderRadius:'8px',cursor:'pointer'}}>Add One Now</button>
            </div>
          ) : meds.map(med => (
            <div key={med.id} className="category-card" style={{backgroundImage:'none',background:'white',border:'1px solid #eee',color:'#333',padding:'16px',display:'flex',justifyContent:'space-between',alignItems:'center',height:'auto',minWidth:'auto'}}>
              <div><h3 style={{color:'#1DB9A6',margin:'0 0 4px 0'}}>{med.name}</h3><p style={{margin:0,color:'#666'}}>{med.dosage} • {med.frequency}</p></div>
              <div style={{fontWeight:'bold',color:'#333',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px'}}>
                 <span>{med.time}</span>
                 <div style={{display:'flex',gap:'8px'}}>
                   <button onClick={(e) => { e.stopPropagation(); setEditingMedId(med.id); setNewMed({name: med.name, dosage: med.dosage, frequency: med.frequency, time: med.time, doses_available: med.doses_available || 0, start_date: med.start_date || '', recurrence: med.recurrence || 'none'}); setActiveTab('add'); }} style={{background:'none',border:'none',color:'#1DB9A6',cursor:'pointer',fontSize:'12px',textDecoration:'underline'}}>Edit</button>
                   <button onClick={(e) => { e.stopPropagation(); handleDeleteMed(med.id); }} style={{background:'none',border:'none',color:'#e74c3c',cursor:'pointer',fontSize:'12px',textDecoration:'underline'}}>Delete</button>
                 </div>
              </div>
            </div>
          ))}
        </div>
        <h2 className="section-title" style={{marginTop:'24px'}}>Quick Actions</h2>
        <div className="doctor-card" onClick={() => setActiveTab('chat')} style={{cursor:'pointer'}}>
          <div className="doctor-info">
            <div className="doctor-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="24" height="24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
            <div><h4>Safety Bot</h4><p>Ask about interactions</p></div>
          </div>
          <button className="icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="#1DB9A6" strokeWidth="2" width="20" height="20"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
        </div>
        <div className="doctor-card" onClick={() => setActiveTab('map')} style={{cursor:'pointer'}}>
          <div className="doctor-info">
            <div className="doctor-avatar" style={{background:'#fde8e8',color:'#e74c3c'}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></div>
            <div><h4>Nearby Pharmacies</h4><p>Find pharmacies on map</p></div>
          </div>
          <button className="icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="#1DB9A6" strokeWidth="2" width="20" height="20"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
        </div>
      </div>
    </div>
  );

  const renderAddMedication = () => (
    <div className="home-container" style={{padding:'20px'}}>
      <div className="chat-header" style={{background:'none',padding:'0 0 20px 0',borderBottom:'1px solid #eee'}}>
        <button onClick={() => { setActiveTab('home'); setEditingMedId(null); setNewMed({ name: '', dosage: '', frequency: '', time: '', doses_available: 0, start_date: '', recurrence: 'none' }); }} className="back-btn" style={{color:'#333',background:'#f5f5f5'}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
        <h2 style={{color:'#333',marginLeft:'16px'}}>{editingMedId ? 'Edit Medication' : 'Add Medication'}</h2>
      </div>

      {/* Image Upload Section */}
      <div style={{marginTop:'20px'}}>
        <div className={`upload-zone ${uploadFile ? 'has-file' : ''}`} onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} />
          <div className="upload-zone-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </div>
          {uploadFile ? <p className="file-name">{uploadFile.name}</p> : <p>Tap to upload medication bottle photo</p>}
          {uploadPreview && <img src={uploadPreview} alt="Preview" className="upload-preview" />}
        </div>
        {uploadFile && (
          <div style={{textAlign:'center'}}>
            <button className="scan-btn" onClick={handleScanBottle} disabled={uploadLoading}>
              {uploadLoading ? <><span className="spinner"></span> Scanning...</> : <>📷 Scan Bottle</>}
            </button>
          </div>
        )}
        {uploadMsg && <div className={uploadMsg.type === 'error' ? 'upload-error' : 'upload-success'}>{uploadMsg.text}</div>}
      </div>

      <div className="upload-divider"><span>or enter manually</span></div>

      <form onSubmit={handleAddMedSubmit} style={{display:'flex',flexDirection:'column',gap:'16px'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <label style={{fontWeight:'bold',color:'#555'}}>Medication Name</label>
          <input required type="text" value={newMed.name} onChange={e => setNewMed({...newMed, name: e.target.value})} placeholder="e.g. Aspirin" style={{padding:'12px',borderRadius:'8px',border:'1px solid #ddd'}} />
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <label style={{fontWeight:'bold',color:'#555'}}>Dosage</label>
          <input required type="text" value={newMed.dosage} onChange={e => setNewMed({...newMed, dosage: e.target.value})} placeholder="e.g. 100mg" style={{padding:'12px',borderRadius:'8px',border:'1px solid #ddd'}} />
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <label style={{fontWeight:'bold',color:'#555'}}>Frequency</label>
          <input required type="text" value={newMed.frequency} onChange={e => setNewMed({...newMed, frequency: e.target.value})} placeholder="e.g. Once daily" style={{padding:'12px',borderRadius:'8px',border:'1px solid #ddd'}} />
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
          <label style={{fontWeight:'bold',color:'#555'}}>Time of Day</label>
          <input required type="time" value={newMed.time} onChange={e => setNewMed({...newMed, time: e.target.value})} style={{padding:'12px',borderRadius:'8px',border:'1px solid #ddd'}} />
        </div>

        <div style={{background:'#f0faf8',borderRadius:'12px',padding:'16px',border:'1px solid #d4f0eb',display:'flex',flexDirection:'column',gap:'16px'}}>
          <h3 style={{color:'#1DB9A6',fontSize:'15px',margin:0}}>📦 Supply & Schedule</h3>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <label style={{fontWeight:'bold',color:'#555'}}>Doses Available in Container</label>
            <input type="number" min="0" value={newMed.doses_available || ''} onChange={e => setNewMed({...newMed, doses_available: parseInt(e.target.value) || 0})} placeholder="e.g. 30" style={{padding:'12px',borderRadius:'8px',border:'1px solid #ddd'}} />
            <span style={{fontSize:'12px',color:'#888'}}>We'll mark the refill date on your calendar</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <label style={{fontWeight:'bold',color:'#555'}}>Start Date</label>
            <input type="date" value={newMed.start_date} onChange={e => setNewMed({...newMed, start_date: e.target.value})} style={{padding:'12px',borderRadius:'8px',border:'1px solid #ddd'}} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
            <label style={{fontWeight:'bold',color:'#555'}}>Recurrence</label>
            <select value={newMed.recurrence} onChange={e => setNewMed({...newMed, recurrence: e.target.value})} style={{padding:'12px',borderRadius:'8px',border:'1px solid #ddd',background:'white'}}>
              <option value="none">No recurrence (one-time)</option>
              <option value="daily">Every day</option>
              <option value="every_other_day">Every other day</option>
              <option value="weekly">Once a week</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="monthly">Once a month</option>
              <option value="custom">Custom days of week</option>
            </select>
          </div>
          {newMed.recurrence === 'custom' && (
            <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
                const selected = (newMed.custom_days || '').includes(day);
                return <button type="button" key={day} onClick={() => {
                  const days = (newMed.custom_days || '').split(',').filter(Boolean);
                  const updated = selected ? days.filter(d => d !== day) : [...days, day];
                  setNewMed({...newMed, custom_days: updated.join(',')});
                }} style={{padding:'8px 12px',borderRadius:'20px',border: selected ? '2px solid #1DB9A6' : '1px solid #ccc', background: selected ? '#e0f7f4' : 'white', color: selected ? '#1DB9A6' : '#666', fontWeight: selected ? 'bold' : 'normal', cursor:'pointer', fontSize:'13px'}}>{day}</button>;
              })}
            </div>
          )}
        </div>

        <div style={{display:'flex',gap:'12px',marginTop:'16px'}}>
          <button type="submit" style={{flex:1,padding:'16px',background:'#1DB9A6',color:'white',border:'none',borderRadius:'12px',fontSize:'16px',fontWeight:'bold',cursor:'pointer'}}>{editingMedId ? 'Save Changes' : 'Save Medication'}</button>
          {editingMedId && (
            <button type="button" onClick={() => handleDeleteMed(editingMedId)} style={{padding:'16px',background:'#fff',color:'#e74c3c',border:'1px solid #e74c3c',borderRadius:'12px',fontSize:'16px',fontWeight:'bold',cursor:'pointer'}}>Delete</button>
          )}
        </div>
      </form>
    </div>
  );

  const renderCalendar = () => {
    const today = new Date();

    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const firstDayOfWeek = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // Mon=0
    const monthName = new Date(calYear, calMonth).toLocaleString('default', { month: 'long', year: 'numeric' });

    // Compute which days have scheduled meds and which are refill warning days
    const getDosesPerDay = (rec) => {
      if (rec === 'daily') return 1;
      if (rec === 'every_other_day') return 0.5;
      if (rec === 'weekly') return 1/7;
      if (rec === 'biweekly') return 1/14;
      if (rec === 'monthly') return 1/30;
      return 1;
    };

    const getRefillDate = (med) => {
      if (!med.doses_available || med.doses_available <= 0) return null;
      if (!med.recurrence || med.recurrence === 'none') return null;
      const start = med.start_date ? new Date(med.start_date) : new Date();
      const dpd = getDosesPerDay(med.recurrence);
      const daysUntilOut = Math.floor(med.doses_available / dpd);
      const refill = new Date(start);
      refill.setDate(refill.getDate() + daysUntilOut);
      return refill;
    };

    const isMedOnDay = (med, dateStr) => {
      if (!med.recurrence || med.recurrence === 'none') {
        return med.start_date === dateStr;
      }
      const start = med.start_date ? new Date(med.start_date) : new Date(med.created_at || today);
      const check = new Date(dateStr);
      if (check < start) return false;

      // Stop recurring after doses run out
      if (med.doses_available && med.doses_available > 0) {
        const refillDate = getRefillDate(med);
        if (refillDate && check > refillDate) return false;
      }

      const diffDays = Math.floor((check - start) / 86400000);
      if (med.recurrence === 'daily') return true;
      if (med.recurrence === 'every_other_day') return diffDays % 2 === 0;
      if (med.recurrence === 'weekly') return diffDays % 7 === 0;
      if (med.recurrence === 'biweekly') return diffDays % 14 === 0;
      if (med.recurrence === 'monthly') return check.getDate() === start.getDate();
      if (med.recurrence === 'custom') {
        const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        return (med.custom_days || '').includes(dayNames[check.getDay()]);
      }
      return false;
    };

    const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    // Build data for each day in month
    const dayData = {};
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      dayData[d] = { meds: [], refills: [], warnings: [] };
      meds.forEach(med => {
        if (isMedOnDay(med, dateStr)) dayData[d].meds.push(med);
        const refDate = getRefillDate(med);
        if (refDate) {
          // Mark the refill date itself
          if (fmtDate(refDate) === dateStr) dayData[d].refills.push(med);
          // Mark 1 day before as an advance warning
          const warnDate = new Date(refDate);
          warnDate.setDate(warnDate.getDate() - 1);
          if (fmtDate(warnDate) === dateStr) dayData[d].warnings.push(med);
        }
      });
    }

    const selectedDateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`;
    const selectedMeds = meds.filter(m => isMedOnDay(m, selectedDateStr));
    const selectedRefills = dayData[selectedDay]?.refills || [];
    const selectedWarnings = dayData[selectedDay]?.warnings || [];

    const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear-1); } else setCalMonth(calMonth-1); setSelectedDay(1); };
    const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear+1); } else setCalMonth(calMonth+1); setSelectedDay(1); };

    const isToday = (d) => d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

    return (
      <div className="home-container" style={{padding:'20px',background:'#f8f9fa',minHeight:'100vh'}}>
        {/* Month nav */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
          <button onClick={prevMonth} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',padding:'8px'}}>◀</button>
          <h2 style={{color:'#333',margin:0,fontSize:'18px'}}>{monthName}</h2>
          <button onClick={nextMonth} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',padding:'8px'}}>▶</button>
        </div>
        {/* Day headers */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'8px'}}>
          {['M','T','W','T','F','S','S'].map((d,i) => <div key={i} style={{textAlign:'center',fontSize:'12px',fontWeight:'bold',color:'#999'}}>{d}</div>)}
        </div>
        {/* Calendar grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'24px'}}>
          {Array(firstDayOfWeek).fill(null).map((_,i) => <div key={'e'+i} />)}
          {Array.from({length: daysInMonth}, (_,i) => i+1).map(d => {
            const hasMed = dayData[d]?.meds.length > 0;
            const hasRefill = dayData[d]?.refills.length > 0;
            const hasWarning = dayData[d]?.warnings.length > 0;
            const sel = d === selectedDay;
            return (
              <div key={d} onClick={() => setSelectedDay(d)} style={{position:'relative',width:'100%',aspectRatio:'1',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderRadius:'12px',cursor:'pointer',background: sel ? '#1DB9A6' : isToday(d) ? '#e0f7f4' : 'transparent',color: sel ? 'white' : '#333',fontWeight: isToday(d) || sel ? 'bold' : 'normal',fontSize:'14px',transition:'all 0.15s ease'}}>
                {d}
                <div style={{display:'flex',gap:'2px',marginTop:'2px',height:'6px'}}>
                  {hasMed && <div style={{width:'6px',height:'6px',borderRadius:'50%',background: sel ? 'rgba(255,255,255,0.7)' : '#1DB9A6'}} />}
                  {hasWarning && <div style={{width:'6px',height:'6px',borderRadius:'50%',background: sel ? '#ffd700' : '#f39c12'}} />}
                  {hasRefill && <div style={{width:'6px',height:'6px',borderRadius:'50%',background: sel ? '#ffd700' : '#e74c3c'}} />}
                </div>
              </div>
            );
          })}
        </div>
        {/* Selected day details */}
        <h3 style={{color:'#333',fontSize:'16px',marginBottom:'12px'}}>
          {new Date(calYear, calMonth, selectedDay).toLocaleDateString('default', {weekday:'long', month:'short', day:'numeric'})}
        </h3>
        {selectedWarnings.length > 0 && selectedWarnings.map(med => (
          <div key={'w'+med.id} style={{background:'#fff8e1',padding:'12px 16px',borderRadius:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'12px',border:'1px solid #ffe082'}}>
            <span style={{fontSize:'20px'}}>🔔</span>
            <div><strong style={{color:'#e65100'}}>{med.name} — Running low!</strong><p style={{margin:'2px 0 0',color:'#888',fontSize:'13px'}}>Only 1 day of doses remaining. Consider getting a refill.</p></div>
          </div>
        ))}
        {selectedRefills.length > 0 && selectedRefills.map(med => (
          <div key={'r'+med.id} style={{background:'#fde8e8',padding:'12px 16px',borderRadius:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'12px',border:'1px solid #f5c6c6'}}>
            <span style={{fontSize:'20px'}}>⚠️</span>
            <div><strong style={{color:'#c0392b'}}>{med.name} — Refill needed!</strong><p style={{margin:'2px 0 0',color:'#888',fontSize:'13px'}}>Your supply of {med.doses_available} doses runs out on this date</p></div>
          </div>
        ))}
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {selectedMeds.length === 0 && selectedRefills.length === 0 && selectedWarnings.length === 0 && <p style={{textAlign:'center',color:'#888',padding:'20px'}}>No medications scheduled for this day.</p>}
          {selectedMeds.map(med => (
            <div key={med.id} style={{background:'white',padding:'16px',borderRadius:'16px',display:'flex',alignItems:'center',gap:'16px',boxShadow:'0 4px 12px rgba(0,0,0,0.05)'}}>
              <div style={{width:'4px',height:'40px',background:'#1DB9A6',borderRadius:'4px'}} />
              <div style={{flex:1}}><h4 style={{margin:'0 0 4px 0',fontSize:'16px'}}>{med.name}</h4><p style={{margin:0,color:'#888',fontSize:'14px'}}>{med.dosage} • {med.recurrence !== 'none' ? med.recurrence.replace('_',' ') : 'One-time'}</p></div>
              <div style={{textAlign:'right'}}><div style={{fontWeight:'bold',color:'#1DB9A6'}}>{med.time}</div>{med.doses_available > 0 && <div style={{fontSize:'11px',color:'#888'}}>{med.doses_available} doses left</div>}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderChat = () => (
    <div className="chat-container">
      <div className="chat-header">
        <button onClick={() => setActiveTab('home')} className="back-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
        <h2>Safety Assistant</h2>
      </div>
      <div className="chat-messages">
        {chatHistory.length === 0 && <div className="empty-chat"><p>Ask about medications, side effects, interactions, or upload a photo to identify a drug.</p></div>}
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="bubble">
              {msg.image && <img src={msg.image} alt="Uploaded" className="chat-image-thumb" />}
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div className="message assistant"><div className="bubble" style={{opacity:0.5}}>Thinking...</div></div>}
      </div>
      {chatImagePreview && (
        <div className="chat-image-preview">
          <img src={chatImagePreview} alt="Preview" />
          <span style={{flex:1,fontSize:'13px',color:'#666'}}>Image attached</span>
          <button className="remove-img" onClick={() => { setChatImage(null); setChatImagePreview(null); }}>Remove</button>
        </div>
      )}
      <form onSubmit={handleChatSubmit} className="chat-input-form">
        <input type="file" ref={chatImageRef} accept="image/*" capture="environment" onChange={handleChatImageChange} style={{display:'none'}} />
        <button type="button" className="chat-attach-btn" onClick={() => chatImageRef.current?.click()} disabled={loading}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        </button>
        <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." disabled={loading} />
        <button type="submit" className="send-btn" disabled={loading && !chatImage}>Send</button>
      </form>
    </div>
  );

  const renderMap = () => (
    <div className="map-container">
      <div className="map-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2" width="24" height="24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <h2>Nearby Pharmacies</h2>
      </div>
      {mapLoading && <div className="map-loading"><div className="spinner-lg"></div><p>Finding pharmacies near you...</p></div>}
      {mapError && <div className="map-error"><p>⚠️ {mapError}</p></div>}
      {userPos && !mapLoading && (
        <>
          <div className="map-wrapper">
            <MapContainer center={[userPos.lat, userPos.lng]} zoom={15} style={{height:'100%',width:'100%'}}>
              <RecenterMap lat={userPos.lat} lng={userPos.lng} />
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}><Popup>You are here</Popup></Marker>
              {pharmacies.map(p => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={pharmacyIcon}>
                  <Popup><strong>{p.name}</strong>{p.address && <><br/>{p.address}</>}{p.hours && <><br/>🕐 {p.hours}</>}<br/>{p.dist.toFixed(1)} km away</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          {pharmacies.length > 0 && (
            <>
              <p className="pharmacy-list-title">{pharmacies.length} pharmacies found</p>
              <div className="pharmacy-list">
                {pharmacies.map(p => (
                  <div key={p.id} className="pharmacy-card">
                    <div className="pharmacy-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
                    <div className="pharmacy-info"><h4>{p.name}</h4><p>{p.address || 'Address not available'}</p></div>
                    <span className="pharmacy-distance">{p.dist.toFixed(1)} km</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  const renderProfile = () => (
    <div className="profile-container">
      <div className="profile-header">
        <button className="profile-edit-btn" onClick={() => { setEditingProfile(!editingProfile); setProfileForm({...profile}); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <div className="profile-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <h2>{profile.name || 'Your Profile'}</h2>
        <p>Medical Safety Companion</p>
      </div>
      {editingProfile ? (
        <div className="profile-form">
          <div className="form-group"><label>Full Name</label><input type="text" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} placeholder="Enter your name" /></div>
          <div className="form-group"><label>Age</label><input type="number" value={profileForm.age || ''} onChange={e => setProfileForm({...profileForm, age: parseInt(e.target.value) || 0})} placeholder="Enter your age" /></div>
          <div className="form-group"><label>Blood Group</label>
            <select value={profileForm.blood_group} onChange={e => setProfileForm({...profileForm, blood_group: e.target.value})}>
              <option value="">Select blood group</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Allergies</label><textarea value={profileForm.allergies} onChange={e => setProfileForm({...profileForm, allergies: e.target.value})} placeholder="List any known allergies..." /></div>
          <div className="form-group"><label>Other Notes</label><textarea value={profileForm.notes} onChange={e => setProfileForm({...profileForm, notes: e.target.value})} placeholder="Any important medical notes..." /></div>
          <div className="form-actions">
            <button className="btn-cancel" onClick={() => setEditingProfile(false)}>Cancel</button>
            <button className="btn-save" onClick={handleSaveProfile} disabled={profileLoading}>{profileLoading ? 'Saving...' : 'Save Profile'}</button>
          </div>
        </div>
      ) : (
        <div className="profile-body">
          <div className="profile-card">
            <div className="profile-card-icon" style={{background:'#e8f5e9',color:'#4caf50'}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
            <div className="profile-card-info"><label>Name</label><span className={`profile-value ${!profile.name ? 'empty' : ''}`}>{profile.name || 'Not set'}</span></div>
          </div>
          <div className="profile-card">
            <div className="profile-card-icon" style={{background:'#e3f2fd',color:'#2196f3'}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg></div>
            <div className="profile-card-info"><label>Age</label><span className={`profile-value ${!profile.age ? 'empty' : ''}`}>{profile.age || 'Not set'}</span></div>
          </div>
          <div className="profile-card">
            <div className="profile-card-icon" style={{background:'#fce4ec',color:'#e91e63'}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
            <div className="profile-card-info"><label>Blood Group</label><span className={`profile-value ${!profile.blood_group ? 'empty' : ''}`}>{profile.blood_group || 'Not set'}</span></div>
          </div>
          <div className="profile-card">
            <div className="profile-card-icon" style={{background:'#fff3e0',color:'#ff9800'}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
            <div className="profile-card-info"><label>Allergies</label><span className={`profile-value ${!profile.allergies ? 'empty' : ''}`}>{profile.allergies || 'None listed'}</span></div>
          </div>
          <div className="profile-card">
            <div className="profile-card-icon" style={{background:'#f3e5f5',color:'#9c27b0'}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div>
            <div className="profile-card-info"><label>Notes</label><span className={`profile-value ${!profile.notes ? 'empty' : ''}`}>{profile.notes || 'No notes'}</span></div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="app-wrapper">
      <div className="mobile-frame">
        {activeTab === 'home' && renderHome()}
        {activeTab === 'chat' && renderChat()}
        {activeTab === 'add' && renderAddMedication()}
        {activeTab === 'calendar' && renderCalendar()}
        {activeTab === 'map' && renderMap()}
        {activeTab === 'profile' && renderProfile()}
      </div>

      {/* Floating Action Button for Add Medication */}
      {activeTab !== 'add' && activeTab !== 'chat' && (
        <button className="fab" onClick={() => { setActiveTab('add'); setEditingMedId(null); setNewMed({ name: '', dosage: '', frequency: '', time: '', doses_available: 0, start_date: '', recurrence: 'none' }); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      )}

      <div className="bottom-nav">
        <button className={activeTab === 'home' ? 'active' : ''} onClick={() => { setActiveTab('home'); setEditingMedId(null); setNewMed({ name: '', dosage: '', frequency: '', time: '', doses_available: 0, start_date: '', recurrence: 'none' }); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </button>
        <button className={activeTab === 'calendar' ? 'active' : ''} onClick={() => setActiveTab('calendar')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </button>
        <button className={activeTab === 'map' ? 'active' : ''} onClick={() => setActiveTab('map')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </button>
        <button className={activeTab === 'chat' ? 'active' : ''} onClick={() => setActiveTab('chat')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </button>
      </div>
    </div>
  )
}

export default App
