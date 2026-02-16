import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, query, orderBy 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Calculator, Landmark, Building2, Calendar, 
  Plus, Trash2, Edit2, Save, X, TrendingUp, 
  Wallet, ChevronRight, History
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wage-calc-app';

export default function App() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [branch, setBranch] = useState('One Bangkok');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState(0);
  const [editingId, setEditingId] = useState(null);

  const branches = {
    'One Bangkok': { wage: 700, icon: Landmark, color: 'blue' },
    'Paragon': { wage: 800, icon: Building2, color: 'indigo' }
  };

  // --- Auth & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // RULE 1: Use specific path structure
    const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'daily_records');
    
    // RULE 2: Simple query, sorting in memory later
    const q = query(recordsRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by date descending in memory
      setRecords(data.sort((a, b) => new Date(b.date) - new Date(a.date)));
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Calculation Logic ---
  const calculateCommission = (amount) => {
    if (amount <= 0) return 0;
    let rate = 1;
    if (amount >= 10000) rate = 4;
    else if (amount >= 8500) rate = 3;
    else if (amount >= 7500) rate = 2;
    else if (amount >= 6000) rate = 1.5;
    return (amount * rate) / 100;
  };

  const totals = useMemo(() => {
    return records.reduce((acc, curr) => {
      acc.wage += curr.wage || 0;
      acc.commission += curr.commission || 0;
      acc.sales += curr.sales || 0;
      return acc;
    }, { wage: 0, commission: 0, sales: 0 });
  }, [records]);

  // --- Actions ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    const commission = calculateCommission(sales);
    const wage = branches[branch].wage;
    const recordData = {
      branch,
      date,
      sales: Number(sales),
      wage,
      commission,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingId) {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_records', editingId);
        await updateDoc(docRef, recordData);
        setEditingId(null);
      } else {
        const recordsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'daily_records');
        await addDoc(recordsRef, recordData);
      }
      // Reset form
      setSales(0);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleEdit = (rec) => {
    setEditingId(rec.id);
    setBranch(rec.branch);
    setDate(rec.date);
    setSales(rec.sales);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'daily_records', id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
  };

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-pulse text-slate-400">กำลังเชื่อมต่อระบบ...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-800">
      {/* Top Banner & Summary */}
      <div className="bg-slate-900 text-white pt-10 pb-24 px-6 rounded-b-[3rem] shadow-2xl">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Calculator className="text-blue-400" />
                ระบบบันทึกรายรับ
              </h1>
              <p className="text-slate-400 text-sm">จัดการค่าแรงและค่าคอมมิชชันรายวัน</p>
            </div>
            <div className="bg-white/10 p-2 rounded-full">
               <Wallet className="text-blue-400" size={24} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">ค่าแรงรวม</p>
              <p className="text-2xl font-black text-blue-300">{formatCurrency(totals.wage)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl backdrop-blur-sm">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">ค่าคอมมิชชันรวม</p>
              <p className="text-2xl font-black text-emerald-400">{formatCurrency(totals.commission)}</p>
            </div>
            <div className="bg-white/10 border border-blue-500/30 p-5 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">ยอดรับรวมทั้งสิ้น</p>
                <p className="text-3xl font-black text-white">{formatCurrency(totals.wage + totals.commission)}</p>
              </div>
              <TrendingUp className="absolute -bottom-2 -right-2 text-white/5" size={80} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 -mt-12 space-y-8">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
          <div className="flex items-center gap-2 mb-6 text-slate-800 font-bold text-lg">
            {editingId ? <Edit2 className="text-orange-500" size={20} /> : <Plus className="text-blue-600" size={20} />}
            {editingId ? 'แก้ไขรายการ' : 'เพิ่มรายการใหม่'}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">เลือกสาขา</label>
              <div className="flex gap-2">
                {Object.keys(branches).map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBranch(b)}
                    className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      branch === b 
                        ? 'bg-slate-900 text-white shadow-lg' 
                        : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {React.createElement(branches[b].icon, { size: 14 })}
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">วันที่</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">ยอดขาย (บาท)</label>
              <input
                type="number"
                value={sales === 0 ? '' : sales}
                onChange={(e) => setSales(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600 text-lg"
                placeholder="0"
              />
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
            >
              {editingId ? <Save size={20} /> : <Plus size={20} />}
              {editingId ? 'บันทึกการแก้ไข' : 'บันทึกรายการ'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { setEditingId(null); setSales(0); }}
                className="px-6 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-2xl font-bold transition-all"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>

        {/* Records List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <History size={18} className="text-slate-400" />
              รายการบันทึกย้อนหลัง
            </h2>
            <span className="text-xs font-bold text-slate-400 bg-slate-200 px-2 py-1 rounded-full">
              {records.length} รายการ
            </span>
          </div>

          {records.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="text-slate-300" />
              </div>
              <p className="text-slate-400 font-medium">ยังไม่มีข้อมูลบันทึกในระบบ</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {records.map((rec) => (
                <div key={rec.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${rec.branch === 'One Bangkok' ? 'bg-blue-100 text-blue-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {React.createElement(branches[rec.branch].icon, { size: 24 })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-slate-800">{rec.branch}</span>
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full text-slate-500 font-bold">
                          {new Date(rec.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium">ยอดขาย: {formatCurrency(rec.sales)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase leading-none mb-1">ค่าแรง</p>
                        <p className="font-bold text-slate-700 leading-none">{formatCurrency(rec.wage)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-emerald-500 font-bold uppercase leading-none mb-1">คอมฯ</p>
                        <p className="font-bold text-emerald-600 leading-none">+{formatCurrency(rec.commission)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <button 
                        onClick={() => handleEdit(rec)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(rec.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}