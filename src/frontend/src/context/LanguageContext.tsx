import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'gu' | 'hi';

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
];

const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    // TopBar & Header
    'grid_ops_center': 'Grid Operations Center',
    'grid_ops_short': 'GridOps',
    'regional_power_grid': 'Regional Power Grid • Transmission & Distribution Operations',
    'storm_alert': 'East Grid Storm Alert',
    'select_language': 'Select Language',
    'operator_console': 'Operator Console',

    // Sidebar Navigation
    'nav_overview': 'Overview',
    'nav_grid_assets': 'Grid Assets',
    'nav_tickets': 'Tickets & Fixes',
    'nav_iot_stream': 'IoT Live Stream',
    'nav_risk_map': 'Risk Map',
    'nav_crew_planning': 'Crew Planning',
    'nav_weather_intel': 'Weather Intel',
    'nav_incidents_log': 'Incidents Log',
    'nav_ai_advisor': 'AI Advisor',
    'nav_users_rbac': 'Users & RBAC',
    'nav_risk_settings': 'Risk Settings',
    'operational_center': 'Operational Center',
    'configuration_engine': 'Configuration & Engine',
    'grid_status': 'Grid Status',
    'health_index': 'Health Index',

    // Advisor Chatbot
    'advisor_header_title': 'GridGuard AI Advisor',
    'advisor_subtitle': 'Real-time conversational grid resilience & operations chatbot powered by IBM Bob AI.',
    'advisor_live_grounding': 'Live Operational Grounding:',
    'recommended_prompts': 'Recommended Operator Diagnostic Inquiries:',
    'ask_button': 'Ask',
    'input_placeholder': 'Ask about grid stability, equipment risk, weather storm tracks, or crew staging in any language...',
    'history_button': 'History',
    'new_chat_button': 'New Chat',
    'ibm_bob_active': 'IBM Bob AI Active',
    'chat_history': 'Chat History',
    'no_saved_conversations': 'No saved conversations yet',
    'clear_all_history': 'Clear All History',
    'diagnostic_evidence': 'Diagnostic Evidence & Telemetry Signals:',
    'recommended_interventions': 'Recommended Grid Interventions:',
    'impact_estimation': 'Outage Avoidance & Impact Estimation:',
    'ask_this_now': 'Ask this now',
    'reasoning_engine': 'IBM Bob AI Engine Reasoning...',
    'analyzing_streams': 'Analyzing SCADA streams, weather squall tracks, and risk matrices',

    // Common UI Labels
    'critical': 'CRITICAL',
    'high_risk': 'HIGH RISK',
    'medium_risk': 'MEDIUM',
    'low_risk': 'LOW',
    'online': 'ONLINE',
    'active': 'Active',
    'live': 'Live',
    'admin': 'Admin',
    'logout': 'Logout',
    'confirm_logout': 'Confirm Logout',
    'cancel': 'Cancel',
  },
  gu: {
    // TopBar & Header
    'grid_ops_center': 'ગ્રીડ ઓપરેશન્સ સેન્ટર',
    'grid_ops_short': 'ગ્રીડ-ઓપ્સ',
    'regional_power_grid': 'પ્રાદેશિક પાવર ગ્રીડ • ટ્રાન્સમિશન અને ડિસ્ટ્રિબ્યુશન કામગીરી',
    'storm_alert': 'પૂર્વ ગ્રીડ વાવાઝોડું એલર્ટ',
    'select_language': 'ભાષા પસંદ કરો',
    'operator_console': 'ઓપરેટર કન્સોલ',

    // Sidebar Navigation
    'nav_overview': 'ઓવરવ્યુ (ઝડપી નજરે)',
    'nav_grid_assets': 'ગ્રીડ એસેટ્સ (સાધનો)',
    'nav_tickets': 'ટિકિટ અને સમારકામ',
    'nav_iot_stream': 'આઈઓટી લાઇવ સ્ટ્રીમ',
    'nav_risk_map': 'જોખમ નકશો (રિસ્ક મેપ)',
    'nav_crew_planning': 'ટીમ પ્લાનિંગ (ક્રૂ)',
    'nav_weather_intel': 'હવામાન માહિતી',
    'nav_incidents_log': 'ઘટનાઓ લોગ',
    'nav_ai_advisor': 'એઆઈ સલાહકાર (એડવાઈઝર)',
    'nav_users_rbac': 'વપરાશકર્તા અને પરવાનગી',
    'nav_risk_settings': 'જોખમ સેટિંગ્સ',
    'operational_center': 'ઓપરેશનલ સેન્ટર',
    'configuration_engine': 'કોન્ફિગરેશન અને એન્જિન',
    'grid_status': 'ગ્રીડ સ્થિતિ',
    'health_index': 'સ્વાસ્થ્ય સૂચકાંક',

    // Advisor Chatbot
    'advisor_header_title': 'ગ્રીડગાર્ડ એઆઈ એડવાઈઝર',
    'advisor_subtitle': 'IBM Bob AI દ્વારા સંચાલિત રીયલ-ટાઇમ ગ્રીડ સ્થિરતા અને ઓપરેશન્સ ચેટબોટ.',
    'advisor_live_grounding': 'લાઇવ ઓપરેશનલ સ્થિતિ:',
    'recommended_prompts': 'ભલામણ કરેલ ઓપરેટર નિદાન પ્રશ્નો:',
    'ask_button': 'પૂછો',
    'input_placeholder': 'ગ્રીડ સ્થિરતા, સાધન જોખમ, વાવાઝોડું અથવા ટીમ વિશે ગુજરાતીમાં પૂછો...',
    'history_button': 'ઇતિહાસ',
    'new_chat_button': 'નવી વાતચીત',
    'ibm_bob_active': 'IBM Bob AI સક્રિય',
    'chat_history': 'વાતચીત ઇતિહાસ',
    'no_saved_conversations': 'હજુ સુધી કોઈ સાચવેલ વાતચીત નથી',
    'clear_all_history': 'બધો ઇતિહાસ સાફ કરો',
    'diagnostic_evidence': 'નિદાન પુરાવા અને ટેલિમેટ્રી સિગ્નલ:',
    'recommended_interventions': 'ભલામણ કરેલ ગ્રીડ પગલાં:',
    'impact_estimation': 'વીજ પુરવઠો બચાવ અને અસર અંદાજ:',
    'ask_this_now': 'હવે આ પૂછો',
    'reasoning_engine': 'IBM Bob AI એન્જિન વિચારણા કરી રહ્યું છે...',
    'analyzing_streams': 'SCADA સ્ટ્રીમ્સ અને વાવાઝોડા ટ્રેકનું પૃથક્કરણ',

    // Common UI Labels
    'critical': 'ગંભીર (CRITICAL)',
    'high_risk': 'ઉચ્ચ જોખમ (HIGH)',
    'medium_risk': 'મધ્યમ (MEDIUM)',
    'low_risk': 'ઓછું (LOW)',
    'online': 'ઓનલાઇન',
    'active': 'સક્રિય',
    'live': 'લાઇવ',
    'admin': 'એડમિન',
    'logout': 'લૉગઆઉટ',
    'confirm_logout': 'લૉગઆઉટ ની પુષ્ટિ કરો',
    'cancel': 'રદ કરો',
  },
  hi: {
    // TopBar & Header
    'grid_ops_center': 'ग्रिड ऑपरेशंस सेंटर',
    'grid_ops_short': 'ग्रिडऑप्स',
    'regional_power_grid': 'क्षेत्रीय पावर ग्रिड • ट्रांसमिशन एवं वितरण संचालन',
    'storm_alert': 'पूर्वी ग्रिड तूफान चेतावनी',
    'select_language': 'भाषा चुनें',
    'operator_console': 'ऑपरेटर कंसोल',

    // Sidebar Navigation
    'nav_overview': 'ओवरव्यू (अवलोकन)',
    'nav_grid_assets': 'ग्रिड संपत्तियां (Assets)',
    'nav_tickets': 'टिकट और मरम्मत',
    'nav_iot_stream': 'आईओटी लाइव स्ट्रीम',
    'nav_risk_map': 'जोखिम मानचित्र (Risk Map)',
    'nav_crew_planning': 'फील्ड टीम योजना',
    'nav_weather_intel': 'मौसम जानकारी',
    'nav_incidents_log': 'घटना लॉग (Incidents)',
    'nav_ai_advisor': 'एआई सलाहकार (Advisor)',
    'nav_users_rbac': 'उपयोगकर्ता एवं अनुमतियाँ',
    'nav_risk_settings': 'जोखिम सेटिंग्स',
    'operational_center': 'संचालन केंद्र',
    'configuration_engine': 'कॉन्फ़िगरेशन एवं इंजन',
    'grid_status': 'ग्रिड स्थिति',
    'health_index': 'स्वास्थ्य सूचकांक',

    // Advisor Chatbot
    'advisor_header_title': 'ग्रिडगार्ड एआई सलाहकार',
    'advisor_subtitle': 'IBM Bob AI द्वारा संचालित रियल-टाइम ग्रिड स्थिरता एवं संचालन चैटबॉट।',
    'advisor_live_grounding': 'लाइव परिचालन स्थिति:',
    'recommended_prompts': 'अनुशंसित ऑपरेटर नैदानिक प्रश्न:',
    'ask_button': 'पूछें',
    'input_placeholder': 'ग्रिड स्थिरता, उपकरण जोखिम, तूफान या फील्ड टीम के बारे में हिंदी में पूछें...',
    'history_button': 'इतिहास',
    'new_chat_button': 'नई बातचीत',
    'ibm_bob_active': 'IBM Bob AI सक्रिय',
    'chat_history': 'बातचीत इतिहास',
    'no_saved_conversations': 'अभी तक कोई सहेजी गई बातचीत नहीं है',
    'clear_all_history': 'सभी इतिहास हटाएं',
    'diagnostic_evidence': 'नैदानिक साक्ष्य एवं टेलीमेट्री सिग्नल:',
    'recommended_interventions': 'अनुशंसित ग्रिड कार्रवाइयां:',
    'impact_estimation': 'आउटेज रोकथाम एवं प्रभाव का आकलन:',
    'ask_this_now': 'अभी यह पूछें',
    'reasoning_engine': 'IBM Bob AI इंजन विश्लेषण कर रहा है...',
    'analyzing_streams': 'SCADA डेटा एवं तूफान के रास्तों का विश्लेषण',

    // Common UI Labels
    'critical': 'गंभीर (CRITICAL)',
    'high_risk': 'उच्च जोखिम (HIGH)',
    'medium_risk': 'मध्यम (MEDIUM)',
    'low_risk': 'कम (LOW)',
    'online': 'ऑनलाइन',
    'active': 'सक्रिय',
    'live': 'लाइव',
    'admin': 'एडमिन',
    'logout': 'लॉगआउट',
    'confirm_logout': 'लॉगआउट की पुष्टि करें',
    'cancel': 'रद्द करें',
  }
};

const STORAGE_KEY = 'gridguard_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
  currentOption: LanguageOption;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Cookie helper for Google Translate integration
function setCookie(name: string, value: string, days: number = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function removeCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language;
      if (saved && (saved === 'en' || saved === 'gu' || saved === 'hi')) {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    const prevLang = language;
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // storage full
    }

    // Update HTML root lang attribute
    document.documentElement.lang = lang;

    // Set cookies across root and domain
    const cookieVal = `/en/${lang}`;
    setCookie('googtrans', cookieVal);
    document.cookie = `googtrans=${cookieVal}; path=/; domain=${window.location.hostname}`;

    if (lang === 'en') {
      removeCookie('googtrans');
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
    }

    // Directly trigger Google Translate combo box if present in DOM
    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (combo) {
      combo.value = lang;
      combo.dispatchEvent(new Event('change'));
    } else if (prevLang !== lang) {
      // Reload page to apply google translate cookie across whole page if combo box isn't ready
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  };

  useEffect(() => {
    document.documentElement.lang = language;
    if (language !== 'en') {
      setCookie('googtrans', `/en/${language}`);
    }
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.en;
    if (dict[key]) return dict[key];
    if (TRANSLATIONS.en[key]) return TRANSLATIONS.en[key];
    return fallback || key;
  };

  const currentOption = LANGUAGE_OPTIONS.find((opt) => opt.code === language) || LANGUAGE_OPTIONS[0];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, currentOption }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
