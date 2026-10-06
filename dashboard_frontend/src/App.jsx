import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  ShieldAlert, 
  Activity, 
  Clock, 
  RefreshCw, 
  Server, 
  Zap,
  BarChart3,
  List,
  AlertTriangle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area 
} from 'recharts';

const API_BASE_URL = "http://localhost"; // Accessible via Ingress
const REFRESH_INTERVAL = 5000; // 5 seconds

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [hours, setHours] = useState(1);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, logsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/stats?hours=${hours}`),
        fetch(`${API_BASE_URL}/fetch?hours=${hours}&limit=50`)
      ]);

      if (!statsRes.ok || !logsRes.ok) throw new Error("Failed to fetch data from API");

      const statsData = await statsRes.json();
      const logsData = await logsRes.json();

      setStats(statsData);
      setLogs(logsData.results);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetchData();
    let interval;
    if (isAutoRefresh) {
      interval = setInterval(fetchData, REFRESH_INTERVAL);
    }
    return () => clearInterval(interval);
  }, [fetchData, isAutoRefresh]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />
          <p className="text-xl font-medium">Initializing SOC Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 lg:p-8 font-sans">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="text-blue-500 w-8 h-8" />
            CyberGuard AI <span className="text-sm bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30 ml-2">v1.0-Core</span>
          </h1>
          <p className="text-slate-400 mt-1">Real-time Intrusion Detection Monitoring</p>
        </div>

        <div className="flex items-center gap-4 bg-slate-900 p-2 rounded-xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-2 px-3 border-r border-slate-700">
            <Clock className="w-4 h-4 text-slate-400" />
            <select 
              value={hours} 
              onChange={(e) => setHours(parseFloat(e.target.value))}
              className="bg-transparent text-sm focus:outline-none cursor-pointer font-medium"
            >
              <option value={0.5} className="bg-slate-900">Last 30 Mins</option>
              <option value={1} className="bg-slate-900">Last 1 Hour</option>
              <option value={6} className="bg-slate-900">Last 6 Hours</option>
              <option value={24} className="bg-slate-900">Last 24 Hours</option>
            </select>
          </div>
          <button 
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all ${
              isAutoRefresh ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isAutoRefresh ? 'animate-spin' : ''}`} />
            <span className="text-sm font-semibold">{isAutoRefresh ? 'Live' : 'Paused'}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-8 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p className="font-medium">Connection Error: {error}. Check if your backend is running at {API_BASE_URL}</p>
        </div>
      )}

      {/* High Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          title="Total Events" 
          value={stats?.summary?.total_events || 0} 
          icon={<Activity className="text-blue-400" />} 
          sub="Processed logs"
        />
        <MetricCard 
          title="Attacks Detected" 
          value={stats?.summary?.attack_events || 0} 
          icon={<ShieldAlert className="text-red-400" />} 
          sub="Flagged instances"
          alert={stats?.summary?.attack_events > 0}
        />
        <MetricCard 
          title="Attack Ratio" 
          value={`${stats?.summary?.attack_ratio || 0}%`} 
          icon={<Zap className="text-amber-400" />} 
          sub="Risk density"
        />
        <MetricCard 
          title="Active Systems" 
          value={stats?.distributions?.services?.length || 0} 
          icon={<Server className="text-emerald-400" />} 
          sub="Monitored services"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Attack Distribution */}
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-white">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Threat Distribution
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.distributions?.labels}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {stats?.distributions?.labels?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.label === 'Normal' ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Services */}
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl shadow-sm">
          <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-white">
            <Server className="w-5 h-5 text-purple-500" />
            Targeted Services
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.distributions?.services}
                  dataKey="count"
                  nameKey="service"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {stats?.distributions?.services?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
            <List className="w-5 h-5 text-blue-500" />
            Real-time Log Stream
          </h3>
          <span className="text-xs text-slate-500 font-mono italic">Showing latest {logs.length} events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Timestamp</th>
                <th className="px-6 py-4 font-medium">Classification</th>
                <th className="px-6 py-4 font-medium">Service</th>
                <th className="px-6 py-4 font-medium">Protocol</th>
                <th className="px-6 py-4 font-medium">Duration</th>
                <th className="px-6 py-4 font-medium">S-Bytes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map((log) => (
                <tr key={log._id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${
                      log.prediction_label === 'Normal' 
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {log.prediction_label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300 font-medium">{log.service || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-400 uppercase">{log.proto}</td>
                  <td className="px-6 py-4 text-sm text-slate-400">{log.dur.toFixed(4)}s</td>
                  <td className="px-6 py-4 text-sm text-slate-400 font-mono">{log.sbytes.toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 italic">
                    No data found for the selected time range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, sub, alert }) => (
  <div className={`bg-slate-900 border ${alert ? 'border-red-500/50 ring-1 ring-red-500/20' : 'border-slate-800'} p-6 rounded-2xl shadow-xl transition-all hover:scale-[1.02]`}>
    <div className="flex justify-between items-start mb-4">
      <div className="p-2 bg-slate-800 rounded-xl">
        {icon}
      </div>
      {alert && (
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}
    </div>
    <div className="space-y-1">
      <h4 className="text-slate-400 text-sm font-medium">{title}</h4>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">{sub}</p>
    </div>
  </div>
);

export default Dashboard;