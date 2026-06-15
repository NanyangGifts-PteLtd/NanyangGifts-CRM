import React, { useMemo } from 'react';
import { BarChart2, TrendingUp, DollarSign, Users, Package, Target, Award, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Client } from '../app/types';

interface ReportsPanelProps {
  clients: Client[];
}

const STATUS_COLORS: Record<string, string> = {
  'New Lead': '#abd2fa',
  'Contacted': '#7692ff',
  'Quoted': '#3d518c',
  'Failed': '#FB3640',
  'Overdue': '#1b2cc1',
  'Follow Up': '#9D4393',
  'Shortlisted': '#344966',
  'Project Started': '#BFCC94',
  'Project Done': '#69DC9E',
  'Closed': '#0D1821',
  'Unqualified': '#0C0C0C',
};

function KPICard({ title, value, subtitle, icon, color }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}20` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{title}</p>
        <p className="text-xl font-bold text-gray-800 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export function ReportsPanel({ clients }: ReportsPanelProps) {
  const stats = useMemo(() => {
    const totalClients = clients.length;
    const activeClients = clients.filter(c => ['Project Started', 'Project Done', 'Shortlisted', 'Quoted', 'Contacted'].includes(c.status)).length;
    const wonClients = clients.filter(c => ['Project Started', 'Project Done', 'Closed'].includes(c.status)).length;
    const lostClients = clients.filter(c => ['Failed', 'Unqualified'].includes(c.status)).length;
    const winRate = totalClients > 0 ? Math.round((wonClients / totalClients) * 100) : 0;

    const totalRevenue = clients.reduce((sum, c) => {
      const val = parseFloat(c.totalPrice.replace(/,/g, '')) || 0;
      return sum + val;
    }, 0);

    const totalItems = clients.reduce((sum, c) => sum + c.subitems.length, 0);

    const statusBreakdown = Object.entries(STATUS_COLORS).map(([status, color]) => ({
      name: status,
      value: clients.filter(c => c.status === status).length,
      color,
    })).filter(d => d.value > 0);

    const pipelineByStatus = Object.entries(STATUS_COLORS).map(([status]) => {
      const statusClients = clients.filter(c => c.status === status);
      const revenue = statusClients.reduce((sum, c) => {
        const val = parseFloat(c.totalPrice.replace(/,/g, '')) || 0;
        return sum + val;
      }, 0);
      return { name: status.replace(' ', '\n'), revenue, count: statusClients.length };
    }).filter(d => d.count > 0);

    const channelBreakdown = ['Forms', 'Email', 'Referral', 'E-comm', 'Whatsapp', 'Call', 'Direct'].map(ch => ({
      name: ch,
      count: clients.filter(c => c.channel === ch).length,
    })).filter(d => d.count > 0);

    const importanceBreakdown = [
      { name: 'High', count: clients.filter(c => c.importance === 'High').length, color: '#E2445C' },
      { name: 'Medium', count: clients.filter(c => c.importance === 'Medium').length, color: '#FFCB00' },
      { name: 'Low', count: clients.filter(c => c.importance === 'Low').length, color: '#00C875' },
    ].filter(d => d.count > 0);

    const paidItems = clients.flatMap(c => c.subitems).filter(s => s.paymentStatus === 'Paid').length;
    const pendingPaymentItems = clients.flatMap(c => c.subitems).filter(s => s.paymentStatus === 'To Pay').length;

    return {
      totalClients, activeClients, wonClients, lostClients, winRate,
      totalRevenue, totalItems, statusBreakdown, pipelineByStatus,
      channelBreakdown, importanceBreakdown, paidItems, pendingPaymentItems,
    };
  }, [clients]);

  const RADIAN = Math.PI / 180;
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, value }: any) => {
    if (value === 0) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 10, fontWeight: 600 }}>
        {value}
      </text>
    );
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f8f9fb] p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <BarChart2 size={18} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800">Reports & KPIs</h1>
            <p className="text-xs text-gray-500">Live dashboard — {clients.length} clients tracked</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Total Clients"
            value={stats.totalClients}
            subtitle={`${stats.activeClients} active`}
            icon={<Users size={18} />}
            color="#0085FF"
          />
          <KPICard
            title="Win Rate"
            value={`${stats.winRate}%`}
            subtitle={`${stats.wonClients} won · ${stats.lostClients} lost`}
            icon={<Target size={18} />}
            color="#00C875"
          />
          <KPICard
            title="Total Revenue"
            value={`SGD ${stats.totalRevenue.toLocaleString()}`}
            subtitle="From confirmed orders"
            icon={<DollarSign size={18} />}
            color="#037F4C"
          />
          <KPICard
            title="Total Items"
            value={stats.totalItems}
            subtitle={`${stats.paidItems} paid · ${stats.pendingPaymentItems} to pay`}
            icon={<Package size={18} />}
            color="#784BD1"
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Pipeline by status - bar chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-blue-500" />
              Pipeline Revenue by Status
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.pipelineByStatus} margin={{ top: 0, right: 10, left: 0, bottom: 40 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#6b7280' }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 9, fill: '#6b7280' }} />
                <Tooltip
                  formatter={(val) => [`SGD ${Number(val ?? 0).toLocaleString()}`, 'Revenue']}
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {stats.pipelineByStatus.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.name.replace('\n', ' ')] || '#0085FF'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status distribution - pie chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Award size={14} className="text-purple-500" />
              Client Status Distribution
            </h3>
            {stats.statusBreakdown.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={stats.statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      labelLine={false}
                      label={renderCustomLabel}
                    >
                      {stats.statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 min-w-0 space-y-1.5">
                  {stats.statusBreakdown.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-gray-600 truncate flex-1">{d.name}</span>
                      <span className="text-xs font-semibold text-gray-700 flex-shrink-0">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-300 text-xs">No data</div>
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Channel breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-700 mb-3">Leads by Channel</h3>
            {stats.channelBreakdown.length > 0 ? (
              <div className="space-y-2">
                {stats.channelBreakdown.sort((a, b) => b.count - a.count).map(d => (
                  <div key={d.name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">{d.name}</span>
                      <span className="text-xs font-semibold text-gray-700">{d.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-blue-500"
                        style={{ width: `${(d.count / stats.totalClients) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-300 text-xs py-8">No channel data</div>
            )}
          </div>

          {/* Importance breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-700 mb-3">Leads by Importance</h3>
            {stats.importanceBreakdown.length > 0 ? (
              <div className="space-y-3">
                {stats.importanceBreakdown.map(d => (
                  <div key={d.name} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${d.color}20` }}>
                      <span className="text-xs font-bold" style={{ color: d.color }}>{d.count}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs text-gray-600">{d.name}</span>
                        <span className="text-xs text-gray-400">{Math.round((d.count / stats.totalClients) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${(d.count / stats.totalClients) * 100}%`, background: d.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-300 text-xs py-8">No data</div>
            )}
          </div>

          {/* Payment summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock size={12} className="text-orange-500" />
              Payment Status
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Paid', count: stats.paidItems, color: '#00C875' },
                { label: 'To Pay', count: stats.pendingPaymentItems, color: '#FF642E' },
                { label: 'Unpaid', count: stats.totalItems - stats.paidItems - stats.pendingPaymentItems, color: '#808080' },
              ].map(d => (
                <div key={d.label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ background: d.color }} />
                  <span className="text-xs text-gray-600 flex-1">{d.label}</span>
                  <span className="text-xs font-bold text-gray-700">{d.count}</span>
                  {stats.totalItems > 0 && (
                    <span className="text-xs text-gray-400 w-10 text-right">
                      {Math.round((d.count / stats.totalItems) * 100)}%
                    </span>
                  )}
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex w-full h-3 rounded-full overflow-hidden gap-0.5">
                  {[
                    { count: stats.paidItems, color: '#00C875' },
                    { count: stats.pendingPaymentItems, color: '#FF642E' },
                    { count: stats.totalItems - stats.paidItems - stats.pendingPaymentItems, color: '#e5e7eb' },
                  ].filter(d => d.count > 0).map((d, i) => (
                    <div
                      key={i}
                      className="h-full rounded-sm"
                      style={{ width: `${(d.count / (stats.totalItems || 1)) * 100}%`, background: d.color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
