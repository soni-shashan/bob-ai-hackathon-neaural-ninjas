import React, { useState, useEffect } from 'react';
import {
  CloudLightning,
  Wind,
  Droplets,
  AlertTriangle,
  Compass,
  Calendar,
  CloudRain,
  Sun,
  CloudSun
} from 'lucide-react';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingSpinner, ErrorMessage } from '../components/common/LoadingSpinner';
import { getWeather, getWeatherForecast, getWeatherAlerts } from '../services/api';
import { WeatherCondition, WeatherForecastDay, AlertNotification } from '../types';

export const WeatherPage: React.FC = () => {
  const [zones, setZones] = useState<WeatherCondition[]>([]);
  const [forecast, setForecast] = useState<WeatherForecastDay[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(null);
      const [zonesRes, forecastRes, alertRes] = await Promise.all([
        getWeather(),
        getWeatherForecast(),
        getWeatherAlerts()
      ]);
      setZones(zonesRes);
      setForecast(forecastRes);
      setAlerts(alertRes);
    } catch (e: any) {
      console.error('Failed to load weather intel', e);
      setError(e.message || 'Failed to retrieve meteorological telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  if (loading && zones.length === 0) {
    return <LoadingSpinner message="Querying Doppler radar & weather intelligence feeds..." />;
  }

  if (error && zones.length === 0) {
    return <ErrorMessage message={error} onRetry={fetchWeather} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1f2d44] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
            <CloudLightning className="w-3.5 h-3.5" />
            Meteorological Intelligence & Grid Weather Exposure
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
            Severe Storm Radar & Multi-Zone Forecast
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized Doppler precipitation tracks, lightning strike density, and ambient thermal loading.
          </p>
        </div>

        <span className="text-xs font-mono text-amber-400 bg-amber-950/80 px-3 py-1.5 rounded border border-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
          Code Orange: Severe East Grid Precipitation
        </span>
      </div>

      {/* Weather Alerts Banner */}
      <div className="space-y-3">
        {alerts.map((al) => (
          <div
            key={al.id}
            className="p-4 rounded-lg bg-red-950/20 border border-red-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-red-900/60 border border-red-700 text-red-300 flex-shrink-0 mt-0.5">
                <CloudRain className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{al.title}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-950 text-red-300 border border-red-700 font-bold uppercase">
                    {al.severity}
                  </span>
                  <span className="text-slate-400 text-[11px]">{al.zone}</span>
                </div>
                <p className="text-slate-300 font-sans text-xs mt-1 leading-relaxed">
                  {al.description}
                </p>
              </div>
            </div>
            <div className="text-slate-400 text-[11px] flex-shrink-0 self-end md:self-auto">
              {al.timestamp}
            </div>
          </div>
        ))}
      </div>

      {/* GRID WEATHER-RISK TABLE */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#1f2d44] bg-[#0e1626]">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            Grid Operational Zones Weather Risk Matrix
          </h2>
          <p className="text-xs text-slate-400">
            Real-time multi-zone weather scoring applied directly to equipment stress multipliers.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1f2d44] text-[11px] font-mono uppercase text-slate-400 bg-[#0b0f17]/70">
                <th className="py-3 px-4 font-semibold">Grid Zone</th>
                <th className="py-3 px-3 font-semibold">Condition</th>
                <th className="py-3 px-3 font-semibold text-right">Rainfall (Prob / mm)</th>
                <th className="py-3 px-3 font-semibold text-right">Wind Speed</th>
                <th className="py-3 px-3 font-semibold text-center">Lightning</th>
                <th className="py-3 px-3 font-semibold text-center">Flood Risk</th>
                <th className="py-3 px-3 font-semibold text-center">Weather Risk</th>
                <th className="py-3 px-4 font-semibold text-right">Assets Affected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#182334] text-xs font-mono">
              {zones.map((z) => (
                <tr key={z.zone} className="hover:bg-[#151f33] transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">
                    <div>{z.zone_name}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{z.zone} Sector</div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-300 font-sans">
                    {z.condition_text}
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-cyan-300 tabular-nums">
                    {z.rainfall_prob}% ({z.rainfall_intensity_mm} mm/h)
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-300 tabular-nums">
                    {z.wind_speed_kmh} km/h
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        z.lightning_risk === 'HIGH'
                          ? 'bg-red-950/80 text-red-300 border-red-800'
                          : z.lightning_risk === 'MODERATE'
                          ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {z.lightning_risk}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                        z.flood_risk === 'ELEVATED'
                          ? 'bg-orange-950/80 text-orange-300 border-orange-800'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {z.flood_risk}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <RiskBadge level={z.weather_risk_level} score={z.weather_score} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-white tabular-nums">
                    {z.affected_assets_count} Assets
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 7-DAY OUTLOOK FORECAST CARDS */}
      <div className="bg-[#111827] border border-[#1f2d44] rounded-lg p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#1f2d44] pb-3 mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            7-Day Synoptic Weather Outlook & Grid Stress
          </h2>
          <span className="text-xs font-mono text-slate-400">Ahmedabad Metropolitan Region</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {forecast.map((day, idx) => {
            const isStormDay = day.condition.toLowerCase().includes('rain') || day.condition.toLowerCase().includes('thunder');
            return (
              <div
                key={idx}
                className={`p-3 rounded-lg border flex flex-col justify-between text-center font-mono ${
                  isStormDay
                    ? 'bg-red-950/20 border-red-800/60 text-red-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-white">{day.day}</div>
                  <div className="text-[10px] text-slate-400">{day.date}</div>

                  <div className="my-2 flex justify-center text-cyan-400">
                    {isStormDay ? (
                      <CloudRain className="w-6 h-6 text-cyan-400 animate-pulse" />
                    ) : (
                      <Sun className="w-6 h-6 text-amber-400" />
                    )}
                  </div>

                  <div className="text-xs font-sans text-slate-200 truncate">{day.condition}</div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px]">
                  <div className="flex justify-center gap-2 font-bold">
                    <span className="text-white">{day.temp_max}°</span>
                    <span className="text-slate-500">{day.temp_min}°</span>
                  </div>
                  <div className="text-[10px] text-cyan-400 mt-1">
                    Rain: {day.rainfall_prob}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
