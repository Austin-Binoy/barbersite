import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Clock, User, Scissors, CheckCircle2, 
  ChevronRight, ChevronLeft, Phone, MapPin, Instagram, 
  LayoutDashboard, LogIn, LogOut, Users, Euro,
  TrendingUp, Search, ExternalLink, ShieldCheck, UserPlus, Settings, Database
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  addDoc,
  updateDoc
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'barber-booking-app';

const SERVICES = [
  { id: 1, name: "The Executive Cut", duration: "45 min", price: 35 },
  { id: 2, name: "Beard Maintenance", duration: "20 min", price: 15 },
  { id: 3, name: "Skin Fade", duration: "40 min", price: 30 },
  { id: 4, name: "Hot Towel Shave", duration: "30 min", price: 25 },
];

const TIME_SLOTS = ["09:00", "09:45", "10:30", "11:15", "13:00", "13:45", "14:30", "15:15", "16:00"];

const getAvailableDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < 21; i++) { 
    const d = new Date();
    d.setDate(today.getDate() + i);
    dates.push({
      full: d.toDateString(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      isToday: d.toDateString() === today.toDateString()
    });
  }
  return dates;
};

export default function App() {
  // --- Auth & Profile State ---
  const [user, setUser] = useState(null);
  const [barberProfile, setBarberProfile] = useState(null);
  const [view, setView] = useState('client-booking'); 
  const [activeBarberId, setActiveBarberId] = useState('evan'); // Default for demo
  const [barberData, setBarberData] = useState(null);
  
  // --- Data State ---
  const [allBookings, setAllBookings] = useState([]);
  const [step, setStep] = useState(2); 
  const [bookingData, setBookingData] = useState({ service: null, date: null, time: null, name: '', phone: '' });
  const [loginForm, setLoginForm] = useState({ email: '', password: '', name: '', specialty: '' });
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // --- 1. Authentication Lifecycle ---
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && !currentUser.isAnonymous) {
        fetchBarberProfile(currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Data Fetching ---
  useEffect(() => {
    if (!user) return;

    // Fetch Public Barber Data for the Client View
    const barberRef = doc(db, 'artifacts', appId, 'public', 'data', 'barbers', activeBarberId);
    getDoc(barberRef).then(docSnap => {
      if (docSnap.exists()) setBarberData(docSnap.data());
      else {
        // Fallback demo data if barber doesn't exist in DB yet
        setBarberData({
          name: "Evan Styles",
          specialty: "Modern Fades",
          bio: "Precision grooming specialist.",
          location: "South William St, Dublin",
          image: "https://images.unsplash.com/photo-1503443207922-dff7d543fd0e?w=400&h=400&fit=crop"
        });
      }
    });

    // Listen for Bookings (Publicly shared for the specific barber)
    const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
    const unsubscribe = onSnapshot(bookingsRef, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllBookings(list);
    }, (err) => console.error(err));

    return () => unsubscribe();
  }, [user, activeBarberId]);

  const fetchBarberProfile = async (uid) => {
    const profileRef = doc(db, 'artifacts', appId, 'users', uid, 'profile', 'info');
    const snap = await getDoc(profileRef);
    if (snap.exists()) setBarberProfile(snap.data());
  };

  // --- 3. Handlers ---
  const handleBooking = async () => {
    if (!user) return;
    const newBooking = {
      barberId: activeBarberId,
      service: bookingData.service,
      time: bookingData.time,
      date: bookingData.date.full,
      name: bookingData.name,
      phone: bookingData.phone,
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bookings'), newBooking);
      
      // OPTIONAL: Trigger Notion Log (Simulation)
      if (barberData?.notionWebhook) {
        console.log("Sending log to Notion Webhook:", barberData.notionWebhook);
        // fetch(barberData.notionWebhook, { method: 'POST', body: JSON.stringify(newBooking) });
      }
      
      setStep(6);
    } catch (err) {
      setError("Failed to save booking.");
    }
  };

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        const res = await createUserWithEmailAndPassword(auth, loginForm.email, loginForm.password);
        const profile = {
          uid: res.user.uid,
          name: loginForm.name,
          specialty: loginForm.specialty,
          email: loginForm.email,
          slug: loginForm.name.toLowerCase().replace(/\s+/g, '-'),
          image: "https://images.unsplash.com/photo-1583195764036-6dc248ac07d9?w=400&h=400&fit=crop"
        };
        // Save to private profile
        await setDoc(doc(db, 'artifacts', appId, 'users', res.user.uid, 'profile', 'info'), profile);
        // Save to public discovery
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'barbers', res.user.uid), profile);
        setBarberProfile(profile);
      } else {
        await signInWithEmailAndPassword(auth, loginForm.email, loginForm.password);
      }
      setView('barber-dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    setBarberProfile(null);
    setView('client-booking');
  };

  // --- 4. Sub-Components ---

  const Navbar = () => (
    <nav className="fixed top-0 w-full bg-black/80 backdrop-blur-xl border-b border-zinc-900 z-50">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 font-black text-lg tracking-tighter cursor-pointer" onClick={() => {setView('client-booking'); setStep(2)}}>
          <Scissors className="w-5 h-5 text-amber-500" />
          {view === 'barber-dashboard' ? 'MANAGEMENT' : (barberData?.name || 'BARBER').toUpperCase()}
        </div>
        <div className="flex gap-4">
          {barberProfile ? (
            <button onClick={() => setView('barber-dashboard')} className="text-zinc-400 hover:text-white flex items-center gap-2 text-sm font-medium">
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
          ) : (
            <button onClick={() => setView('barber-login')} className="text-zinc-500 hover:text-white flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="w-4 h-4" /> Staff
            </button>
          )}
        </div>
      </div>
    </nav>
  );

  const BarberBookingPage = () => {
    const availableDates = getAvailableDates();
    if (!barberData) return <div className="pt-32 text-center text-zinc-500">Loading Barber...</div>;

    return (
      <div className="max-w-xl mx-auto py-24 px-6 min-h-screen">
        <div className="text-center mb-12">
          <img src={barberData.image} className="w-24 h-24 rounded-full object-cover border-4 border-zinc-900 mx-auto mb-4 shadow-2xl" />
          <h1 className="text-3xl font-black tracking-tighter mb-2">{barberData.name}</h1>
          <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-4">{barberData.specialty}</p>
          <div className="flex items-center justify-center gap-4 text-xs font-bold text-zinc-400 uppercase">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/> {barberData.location || 'Dublin, IE'}</span>
          </div>
        </div>

        {step < 6 && (
          <div className="flex justify-between mb-12 px-2">
            {[2, 3, 4, 5].map(i => (
              <div key={i} className={`h-1 flex-1 mx-1 rounded-full ${step >= i ? 'bg-amber-500' : 'bg-zinc-800'}`} />
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="font-black uppercase text-xs tracking-widest text-zinc-500 mb-4">Choose a Service</h3>
            <div className="space-y-3">
              {SERVICES.map(s => (
                <button 
                  key={s.id}
                  onClick={() => {setBookingData({...bookingData, service: s}); setStep(3)}}
                  className="w-full flex justify-between items-center p-5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-amber-500 transition-all text-left"
                >
                  <div>
                    <h4 className="font-bold">{s.name}</h4>
                    <p className="text-zinc-500 text-sm">{s.duration}</p>
                  </div>
                  <p className="text-lg font-black">€{s.price}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-black uppercase text-xs tracking-widest text-zinc-500 mb-6">Select Date</h3>
            <div className="flex overflow-x-auto pb-6 gap-3 snap-x no-scrollbar">
              {availableDates.map((d, i) => (
                <button 
                  key={i}
                  onClick={() => {setBookingData({...bookingData, date: d}); setStep(4)}}
                  className={`flex-shrink-0 w-20 flex flex-col items-center py-5 px-3 rounded-2xl border transition-all snap-start ${
                    bookingData.date?.full === d.full ? 'border-amber-500 bg-amber-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase mb-2">{d.dayName}</span>
                  <span className="text-2xl font-black leading-none mb-1">{d.dayNum}</span>
                  <span className="text-[9px] uppercase font-bold">{d.month}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} className="mt-8 text-zinc-500 text-sm flex items-center gap-1">
              <ChevronLeft className="w-4 h-4"/> Back to services
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="font-black uppercase text-xs tracking-widest text-zinc-500 mb-6">Times for {bookingData.date?.dayNum} {bookingData.date?.month}</h3>
            <div className="grid grid-cols-3 gap-3">
              {TIME_SLOTS.map(t => (
                <button 
                  key={t}
                  onClick={() => {setBookingData({...bookingData, time: t}); setStep(5)}}
                  className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-amber-500 hover:text-white transition-all font-bold"
                >
                  {t}
                </button>
              ))}
            </div>
            <button onClick={() => setStep(3)} className="mt-8 text-zinc-500 text-sm flex items-center gap-1">
              <ChevronLeft className="w-4 h-4"/> Back to dates
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-center">Your Details</h3>
            <div className="space-y-4 mb-8">
              <input type="text" placeholder="Full Name" className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white" onChange={(e) => setBookingData({...bookingData, name: e.target.value})} />
              <input type="tel" placeholder="Phone Number" className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white" onChange={(e) => setBookingData({...bookingData, phone: e.target.value})} />
            </div>
            <button onClick={handleBooking} disabled={!bookingData.name || !bookingData.phone} className="w-full bg-amber-500 text-white py-4 rounded-xl font-black hover:bg-amber-600 disabled:opacity-50 transition-all">
              Confirm Appointment
            </button>
          </div>
        )}

        {step === 6 && (
          <div className="text-center bg-zinc-900/50 border border-zinc-800 p-12 rounded-3xl animate-in zoom-in">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-black mb-2">Confirmed!</h2>
            <p className="text-zinc-400 text-sm mb-8">See you on {bookingData.date?.dayName} at {bookingData.time}.</p>
            <button onClick={() => setStep(2)} className="text-amber-500 font-bold text-sm">Book another session</button>
          </div>
        )}
      </div>
    );
  };

  const BarberAuth = () => (
    <div className="flex items-center justify-center min-h-screen px-6">
      <form onSubmit={handleAuthAction} className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
        <h2 className="text-3xl font-black mb-2">{isRegistering ? 'Join the Platform' : 'Barber Portal'}</h2>
        <p className="text-zinc-500 mb-8">{isRegistering ? 'Create your unique booking link.' : 'Login to manage your schedule.'}</p>
        
        {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-lg mb-6 text-xs font-bold">{error}</div>}
        
        <div className="space-y-4 mb-8">
          {isRegistering && (
            <>
              <input type="text" placeholder="Business/Barber Name" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white" value={loginForm.name} onChange={e => setLoginForm({...loginForm, name: e.target.value})} required />
              <input type="text" placeholder="Specialty (e.g. Skin Fades)" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white" value={loginForm.specialty} onChange={e => setLoginForm({...loginForm, specialty: e.target.value})} required />
            </>
          )}
          <input type="email" placeholder="Email Address" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white" value={loginForm.email} onChange={e => setLoginForm({...loginForm, email: e.target.value})} required />
          <input type="password" placeholder="Password" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required />
        </div>
        
        <button type="submit" className="w-full bg-white text-black py-4 rounded-xl font-black hover:bg-zinc-200 transition-all uppercase">
          {isRegistering ? 'Create Account' : 'Sign In'}
        </button>
        
        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-zinc-500 text-xs font-bold">
          {isRegistering ? 'Already have an account? Sign In' : 'New Barber? Join here'}
        </button>
      </form>
    </div>
  );

  const Dashboard = () => {
    const myBookings = allBookings.filter(b => b.barberId === (barberProfile?.uid || activeBarberId));
    const totalRevenue = myBookings.reduce((acc, curr) => acc + curr.service.price, 0);

    return (
      <div className="min-h-screen pt-24 px-6 max-w-5xl mx-auto pb-20">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-black tracking-tighter">Hello, {barberProfile?.name?.split(' ')[0] || 'Barber'}</h1>
            <p className="text-zinc-500 text-sm flex items-center gap-1">
              Your link: <span className="text-amber-500 font-bold">thecut.com/{barberProfile?.slug || 'link'}</span>
            </p>
          </div>
          <button onClick={handleSignOut} className="text-zinc-500 hover:text-white flex items-center gap-2"><LogOut className="w-4 h-4" /> Exit</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
            <Users className="text-amber-500 mb-4" />
            <h4 className="text-zinc-500 text-[10px] font-black uppercase mb-1">Bookings</h4>
            <p className="text-4xl font-black">{myBookings.length}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
            <Euro className="text-green-500 mb-4" />
            <h4 className="text-zinc-500 text-[10px] font-black uppercase mb-1">Revenue</h4>
            <p className="text-4xl font-black">€{totalRevenue}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
            <Settings className="text-blue-500 mb-4" />
            <h4 className="text-zinc-500 text-[10px] font-black uppercase mb-1">Automation</h4>
            <p className="text-xs text-zinc-400 mt-2 font-bold">NOTION LOGS: <span className="text-green-500">ACTIVE</span></p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
            <h3 className="text-lg font-bold">Upcoming Appointments</h3>
            <Database className="w-4 h-4 text-zinc-700" />
          </div>
          <div className="divide-y divide-zinc-800">
            {myBookings.length > 0 ? myBookings.map(b => (
              <div key={b.id} className="p-6 flex items-center justify-between hover:bg-zinc-800/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center font-black text-amber-500 border border-zinc-700">{b.name.charAt(0)}</div>
                  <div>
                    <h5 className="font-bold text-sm">{b.name}</h5>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{b.service.name} • {b.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg text-amber-500">{b.time}</p>
                </div>
              </div>
            )) : (
              <div className="p-16 text-center text-zinc-500 font-medium">No appointments saved in database yet.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30">
      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      <Navbar />
      <main className="relative z-10">
        {view === 'client-booking' && <BarberBookingPage />}
        {view === 'barber-login' && <BarberAuth />}
        {view === 'barber-dashboard' && <Dashboard />}
      </main>
    </div>
  );
}