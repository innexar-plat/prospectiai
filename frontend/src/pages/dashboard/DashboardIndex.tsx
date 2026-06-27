import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useOutletContext, useSearchParams, Link } from 'react-router-dom';
import {
  Zap, Loader2, Sparkles, UtensilsCrossed, Scissors, Dumbbell, Stethoscope,
  ShoppingBag, Wrench, Building2, Scale, PawPrint, Heart, Hotel, Pill,
  GraduationCap, Globe, Phone, type LucideIcon, Megaphone, ShieldCheck, Laptop,
  Plane, HardHat, Coffee, Eye, Car, Pizza, BookOpen, Clock, ArrowRight, Truck,
  Paintbrush, Music, Flower2, Hammer, Bike, Baby, Shirt, Gem, Droplets,
  Clapperboard, Warehouse, TreePine, ChevronDown, ChevronRight, X, Save,
  Search as SearchIcon, Target, Star, TrendingUp, Tractor, Factory,
  Camera, Sofa, PartyPopper, Banknote, Activity, Waves, Utensils,
  CircleDot, Info,
} from 'lucide-react';
import { leadsApi, searchApi, type LeadStats, type SearchHistoryItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import { HeaderDashboard } from '@/components/dashboard/HeaderDashboard';
import { CnaeAutocomplete } from '@/components/dashboard/CnaeAutocomplete';
import { Button } from '@/components/ui/Button';
import { startSearch, validateSearchPayload, buildTextQuery } from '@/lib/searchService';
import { useToast } from '@/contexts/ToastContext';
import { useSearchResults } from '@/contexts/SearchResultsContext';
import { createDefaultSearchValues } from '@/lib/searchFormSchema';
import type { SearchFormValues } from '@/lib/searchFormSchema';
import { COUNTRIES, getCountryLabel, getLocalizedCountryLabel, getStatesByCountry, normalizeCountryCode, getStateLabel } from '@/lib/locationData';
import type { StateOption } from '@/lib/locationData';
import { PLACE_TYPE_CATEGORIES } from '@/lib/placeTypes';
import type { SessionUser } from '@/lib/api';
import { UpgradeCTAModal } from '@/components/dashboard/UpgradeCTAModal';
import { isTrialExpiredUser } from '@/lib/billing-config';
import { isMarketFeatureEnabled, isTrialEnabled, needsSubscription, US_STARTER_CREDITS, US_STARTER_PRICE_USD } from '@/lib/market';
import { useI18n } from '@/lib/i18n';
import { resolveSearchCategoryGroups } from '@/lib/searchTemplateGroups.us';
import { FirstSearchHintBanner } from '@/components/dashboard/FirstSearchHintBanner';
import type { FirstSearchExample } from '@/lib/first-search-hint';
import { formatCreditUsage } from '@/lib/credits-display';
import { TOUR_STEP_EVENT } from '@/lib/tour-placement';

/* ─────────── constants ─────────── */

const MIN_ADVANCED_TERM = 3;
const RADIUS_OPTIONS = [5, 10, 20, 50];
const SEARCH_PROFILES_KEY = 'prospector-search-profiles';

interface SearchProfile {
  id: string;
  name: string;
  country: string;
  states: string[];
  city: string;
  radiusKm: number;
}

interface ProfilesData {
  profiles: SearchProfile[];
  activeId: string | null;
}

function generateProfileId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadProfiles(): ProfilesData {
  try {
    const raw = localStorage.getItem(SEARCH_PROFILES_KEY);
    if (!raw) return { profiles: [], activeId: null };
    return JSON.parse(raw) as ProfilesData;
  } catch { return { profiles: [], activeId: null }; }
}

function persistProfiles(data: ProfilesData) {
  localStorage.setItem(SEARCH_PROFILES_KEY, JSON.stringify(data));
}

/* ─────────── Templates agrupados por categoria ─────────── */

interface SearchTemplate {
  label: string;
  icon: LucideIcon;
  niches: string[];
  includedType?: string;
  cnaes?: string[];
}

interface CategoryGroup {
  label: string;
  templates: SearchTemplate[];
}

const BR_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    label: 'SAÚDE & BEM-ESTAR',
    templates: [
      { label: 'Clínicas', icon: Stethoscope, niches: ['clínica', 'consultório'], includedType: 'doctor', cnaes: ['8630501', '8630502', '8630503', '8630504'] },
      { label: 'Dentistas', icon: Heart, niches: ['dentista', 'odontologia'], includedType: 'dentist', cnaes: ['8630506'] },
      { label: 'Farmácias', icon: Pill, niches: ['farmácia', 'drogaria'], includedType: 'pharmacy', cnaes: ['4771701', '4771702', '4771703'] },
      { label: 'Academias', icon: Dumbbell, niches: ['academia', 'fitness'], includedType: 'gym', cnaes: ['9313100', '9319101'] },
      { label: 'Fisioterapia', icon: Activity, niches: ['fisioterapia', 'fisioterapeuta'], includedType: 'physiotherapist', cnaes: ['8650006'] },
      { label: 'Hospitais', icon: Stethoscope, niches: ['hospital'], includedType: 'hospital', cnaes: ['8610101', '8610102'] },
      { label: 'Laboratórios', icon: Stethoscope, niches: ['laboratório', 'análises clínicas'], includedType: 'medical_lab', cnaes: ['8640202'] },
      { label: 'Psicólogos', icon: Heart, niches: ['psicólogo', 'psicologia'], cnaes: ['8650003'] },
      { label: 'Nutricionistas', icon: Heart, niches: ['nutricionista', 'nutrição'], cnaes: ['8650004'] },
    ],
  },
  {
    label: 'ALIMENTAÇÃO',
    templates: [
      { label: 'Restaurantes', icon: UtensilsCrossed, niches: ['restaurante'], includedType: 'restaurant', cnaes: ['5611201', '5611202', '5611203'] },
      { label: 'Cafeterias', icon: Coffee, niches: ['cafeteria', 'padaria', 'café'], includedType: 'cafe', cnaes: ['5611203', '1091101', '1091102'] },
      { label: 'Pizzarias', icon: Pizza, niches: ['pizzaria'], includedType: 'pizza_restaurant', cnaes: ['5611201'] },
      { label: 'Padarias', icon: Utensils, niches: ['padaria', 'confeitaria'], includedType: 'bakery', cnaes: ['1091101', '1091102'] },
      { label: 'Bares', icon: Coffee, niches: ['bar', 'pub'], includedType: 'bar', cnaes: ['5611204', '5611205'] },
      { label: 'Hamburguerias', icon: UtensilsCrossed, niches: ['hamburgueria', 'hambúrguer'], includedType: 'fast_food_restaurant', cnaes: ['5611201'] },
      { label: 'Sorveterias', icon: UtensilsCrossed, niches: ['sorveteria', 'açaí'], includedType: 'ice_cream_shop', cnaes: ['4721104'] },
      { label: 'Supermercados', icon: Warehouse, niches: ['supermercado', 'mercearia'], includedType: 'supermarket', cnaes: ['4711301', '4711302'] },
    ],
  },
  {
    label: 'BELEZA & ESTÉTICA',
    templates: [
      { label: 'Salões de Beleza', icon: Scissors, niches: ['salão de beleza', 'barbearia'], includedType: 'beauty_salon', cnaes: ['9602501', '9602502'] },
      { label: 'Barbearias', icon: Scissors, niches: ['barbearia'], includedType: 'barber_shop', cnaes: ['9602501'] },
      { label: 'Clínicas Estéticas', icon: Sparkles, niches: ['clínica estética', 'estética'], includedType: 'skin_care_clinic', cnaes: ['9602503'] },
      { label: 'Spas', icon: Waves, niches: ['spa', 'day spa'], includedType: 'spa', cnaes: ['9609207'] },
    ],
  },
  {
    label: 'SERVIÇOS PROFISSIONAIS',
    templates: [
      { label: 'Advogados', icon: Scale, niches: ['advogado', 'escritório de advocacia'], includedType: 'lawyer', cnaes: ['6911701', '6911702', '6911703'] },
      { label: 'Contadores', icon: Building2, niches: ['contabilidade', 'contador'], includedType: 'accounting', cnaes: ['6920601', '6920602'] },
      { label: 'Imobiliárias', icon: Building2, niches: ['imobiliária'], includedType: 'real_estate_agency', cnaes: ['6821801', '6821802'] },
      { label: 'Ag. Marketing', icon: Megaphone, niches: ['agência de marketing', 'marketing digital'], includedType: 'marketing_consultant', cnaes: ['7311400', '7312200', '6319400'] },
      { label: 'Seguradoras', icon: ShieldCheck, niches: ['seguradora', 'seguros'], includedType: 'insurance_agency', cnaes: ['6622300', '6621501', '6621502'] },
      { label: 'Consultorias', icon: Building2, niches: ['consultoria', 'consultor'], includedType: 'consultant', cnaes: ['7020400'] },
      { label: 'Coworkings', icon: Laptop, niches: ['coworking', 'escritório compartilhado'], includedType: 'coworking_space', cnaes: ['8211300'] },
      { label: 'Despachantes', icon: BookOpen, niches: ['despachante', 'documentos'], cnaes: ['6911702'] },
    ],
  },
  {
    label: 'COMÉRCIO & VAREJO',
    templates: [
      { label: 'Lojas', icon: ShoppingBag, niches: ['loja', 'comércio'], includedType: 'store', cnaes: ['4712100', '4713002', '4713004'] },
      { label: 'Pet Shops', icon: PawPrint, niches: ['pet shop', 'veterinário'], includedType: 'pet_store', cnaes: ['4789004', '7500100'] },
      { label: 'Moda Feminina', icon: Shirt, niches: ['moda feminina', 'boutique'], includedType: 'clothing_store', cnaes: ['4781400', '4712100'] },
      { label: 'Joalherias', icon: Gem, niches: ['joalheria', 'relojoaria', 'bijuteria'], includedType: 'jewelry_store', cnaes: ['4783101', '4783102'] },
      { label: 'Óticas', icon: Eye, niches: ['ótica', 'óculos'], cnaes: ['4774100'] },
      { label: 'Lojas Infantis', icon: Baby, niches: ['loja infantil', 'moda infantil'], cnaes: ['4781400'] },
      { label: 'Livrarias', icon: BookOpen, niches: ['livraria', 'papelaria'], includedType: 'book_store', cnaes: ['4761003'] },
      { label: 'Bicicletarias', icon: Bike, niches: ['bicicletaria', 'loja de bicicletas'], includedType: 'bicycle_store', cnaes: ['4763602', '9529199'] },
    ],
  },
  {
    label: 'AUTOMOTIVO',
    templates: [
      { label: 'Oficinas', icon: Wrench, niches: ['oficina mecânica', 'auto center'], includedType: 'car_repair', cnaes: ['4520001', '4520002', '4520003'] },
      { label: 'Lava-rápido', icon: Car, niches: ['lava-rápido', 'lavagem automotiva'], includedType: 'car_wash', cnaes: ['4520005'] },
      { label: 'Autoescolas', icon: BookOpen, niches: ['autoescola', 'centro de formação de condutores'], cnaes: ['8599604'] },
      { label: 'Concessionárias', icon: Car, niches: ['concessionária', 'revenda de veículos'], includedType: 'car_dealer', cnaes: ['4511101', '4511102'] },
      { label: 'Auto Peças', icon: Wrench, niches: ['auto peças', 'peças automotivas'], includedType: 'auto_parts_store', cnaes: ['4530703', '4530704'] },
      { label: 'Postos', icon: Car, niches: ['posto de gasolina', 'combustível'], includedType: 'gas_station', cnaes: ['4731800'] },
      { label: 'Pneus', icon: CircleDot, niches: ['pneu', 'borracharia'], includedType: 'tire_shop', cnaes: ['4530705'] },
    ],
  },
  {
    label: 'EDUCAÇÃO',
    templates: [
      { label: 'Escolas', icon: GraduationCap, niches: ['escola', 'colégio'], includedType: 'school', cnaes: ['8511200', '8512100', '8513900'] },
      { label: 'Cursos', icon: GraduationCap, niches: ['curso', 'escola técnica'], cnaes: ['8541400', '8542200'] },
      { label: 'Faculdades', icon: GraduationCap, niches: ['faculdade', 'universidade'], includedType: 'university', cnaes: ['8531700', '8532500'] },
      { label: 'Creches', icon: Baby, niches: ['creche', 'maternal'], includedType: 'preschool', cnaes: ['8511200'] },
      { label: 'Idiomas', icon: Globe, niches: ['escola de idiomas', 'inglês', 'línguas'], cnaes: ['8593700'] },
    ],
  },
  {
    label: 'HOSPEDAGEM & TURISMO',
    templates: [
      { label: 'Hotéis', icon: Hotel, niches: ['hotel', 'pousada'], includedType: 'hotel', cnaes: ['5510801', '5510802', '5510803'] },
      { label: 'Pousadas', icon: Hotel, niches: ['pousada', 'chalé'], includedType: 'inn', cnaes: ['5510802'] },
      { label: 'Ag. Viagens', icon: Plane, niches: ['agência de viagens', 'turismo'], includedType: 'travel_agency', cnaes: ['7911200', '7912100'] },
      { label: 'Hostels', icon: Hotel, niches: ['hostel', 'albergue'], includedType: 'hostel', cnaes: ['5510803'] },
      { label: 'Resorts', icon: Hotel, niches: ['resort', 'resort hotel'], includedType: 'resort_hotel', cnaes: ['5510801'] },
    ],
  },
  {
    label: 'CONSTRUÇÃO & REFORMAS',
    templates: [
      { label: 'Construtoras', icon: HardHat, niches: ['construtora', 'construção civil'], includedType: 'general_contractor', cnaes: ['4120400', '4110700'] },
      { label: 'Mat. Construção', icon: Hammer, niches: ['material de construção', 'ferragem'], includedType: 'hardware_store', cnaes: ['4744099', '4744001'] },
      { label: 'Engenharia', icon: HardHat, niches: ['engenharia', 'projetos'], cnaes: ['7112000', '7111100'] },
      { label: 'Arquitetura', icon: HardHat, niches: ['arquitetura', 'design de interiores'], cnaes: ['7111100'] },
      { label: 'Vidraçarias', icon: HardHat, niches: ['vidraçaria', 'vidros'], cnaes: ['4743100'] },
      { label: 'Serralheria', icon: Wrench, niches: ['serralheria', 'metalúrgica'], cnaes: ['2542000'] },
      { label: 'Elétrica', icon: Zap, niches: ['eletricista', 'instalação elétrica'], includedType: 'electrician', cnaes: ['4321500'] },
      { label: 'Hidráulica', icon: Wrench, niches: ['encanador', 'hidráulica'], includedType: 'plumber', cnaes: ['4322301'] },
    ],
  },
  {
    label: 'TECNOLOGIA & TI',
    templates: [
      { label: 'Software Houses', icon: Laptop, niches: ['software', 'desenvolvimento', 'TI'], cnaes: ['6201501', '6201502'] },
      { label: 'Agências Web', icon: Globe, niches: ['agência web', 'criação de sites'], cnaes: ['6319400', '6311900'] },
      { label: 'Assist. Técnica', icon: Wrench, niches: ['assistência técnica', 'conserto'], cnaes: ['9511800', '4751200'] },
      { label: 'Eletrônicos', icon: Laptop, niches: ['eletrônicos', 'informática'], includedType: 'electronics_store', cnaes: ['4751200', '4753900'] },
      { label: 'Automação', icon: Laptop, niches: ['automação', 'automação comercial'], cnaes: ['2651500', '3321000'] },
    ],
  },
  {
    label: 'AGRONEGÓCIO',
    templates: [
      { label: 'Cooperativas', icon: Tractor, niches: ['cooperativa agrícola', 'cooperativa'], cnaes: ['0161003', '4623108'] },
      { label: 'Insumos Agrícolas', icon: Tractor, niches: ['insumos agrícolas', 'defensivos'], cnaes: ['4683400', '4684201'] },
      { label: 'Máq. Agrícolas', icon: Tractor, niches: ['máquinas agrícolas', 'tratores'], cnaes: ['4661300', '2831300'] },
      { label: 'Vet. Rural', icon: PawPrint, niches: ['veterinária rural', 'veterinário'], includedType: 'veterinary_care', cnaes: ['7500100'] },
      { label: 'Pecuária', icon: Tractor, niches: ['pecuária', 'gado'], includedType: 'ranch', cnaes: ['0151201', '0151202'] },
      { label: 'Grãos', icon: Tractor, niches: ['grãos', 'soja', 'milho', 'cereais'], cnaes: ['0111301', '0111302'] },
    ],
  },
  {
    label: 'INDÚSTRIA & MANUFATURA',
    templates: [
      { label: 'Metalúrgicas', icon: Factory, niches: ['metalúrgica', 'usinagem'], cnaes: ['2451200', '2511000'] },
      { label: 'Gráficas', icon: Paintbrush, niches: ['gráfica', 'impressão digital'], cnaes: ['1811301', '1811302', '1812100'] },
      { label: 'Têxteis', icon: Shirt, niches: ['têxtil', 'confecção', 'moda'], cnaes: ['1411801', '1412601'] },
      { label: 'Plásticos', icon: Factory, niches: ['plástico', 'embalagens plásticas'], cnaes: ['2229301', '2222600'] },
      { label: 'Embalagens', icon: Factory, niches: ['embalagens', 'cartonagem'], cnaes: ['1731100', '1732000'] },
      { label: 'Químicas', icon: Factory, niches: ['química', 'produtos químicos'], cnaes: ['2029100', '2099199'] },
      { label: 'Alimentos', icon: Factory, niches: ['indústria alimentícia', 'fabricação de alimentos'], includedType: 'manufacturer', cnaes: ['1099699', '1091101'] },
      { label: 'Móveis', icon: Sofa, niches: ['indústria de móveis', 'móveis planejados'], cnaes: ['3101200', '3102100'] },
    ],
  },
  {
    label: 'TRANSPORTE & LOGÍSTICA',
    templates: [
      { label: 'Transportadoras', icon: Truck, niches: ['transportadora', 'logística'], cnaes: ['4930202', '4930201', '5211701'] },
      { label: 'Mudanças', icon: Truck, niches: ['mudança', 'frete'], includedType: 'moving_company', cnaes: ['4930204'] },
      { label: 'Entregas', icon: Truck, niches: ['motoboy', 'entregas rápidas'], includedType: 'courier_service', cnaes: ['5320202'] },
      { label: 'Táxi / App', icon: Car, niches: ['táxi', 'transporte executivo'], cnaes: ['4923002', '4929901'] },
    ],
  },
  {
    label: 'COMUNICAÇÃO & MÍDIA',
    templates: [
      { label: 'Fotografia', icon: Camera, niches: ['fotógrafo', 'estúdio fotográfico'], cnaes: ['7420001', '7420002'] },
      { label: 'Vídeo', icon: Clapperboard, niches: ['produtora de vídeo', 'filmagem'], cnaes: ['5911101', '5911102'] },
      { label: 'Est. de Música', icon: Music, niches: ['estúdio musical', 'escola de música'], cnaes: ['8592901', '9001901'] },
      { label: 'Design', icon: Paintbrush, niches: ['design gráfico', 'designer'], cnaes: ['7410202', '7410203'] },
    ],
  },
  {
    label: 'CASA & DECORAÇÃO',
    templates: [
      { label: 'Floriculturas', icon: Flower2, niches: ['floricultura', 'flores'], includedType: 'florist', cnaes: ['4789001'] },
      { label: 'Paisagismo', icon: TreePine, niches: ['paisagismo', 'jardinagem'], cnaes: ['8130300', '0121101'] },
      { label: 'Lavanderias', icon: Droplets, niches: ['lavanderia', 'limpeza a seco'], includedType: 'laundry', cnaes: ['9601702', '9601701'] },
      { label: 'Decoração', icon: Sofa, niches: ['decoração', 'loja de decoração'], cnaes: ['4759801'] },
      { label: 'Móveis Plan.', icon: Sofa, niches: ['móveis planejados', 'marcenaria'], includedType: 'furniture_store', cnaes: ['3101200', '3102100'] },
    ],
  },
  {
    label: 'EVENTOS & FESTAS',
    templates: [
      { label: 'Buffets', icon: PartyPopper, niches: ['buffet', 'casa de festas'], includedType: 'banquet_hall', cnaes: ['5620101', '5620102'] },
      { label: 'Casas de Festas', icon: PartyPopper, niches: ['casa de festas', 'salão de festas'], includedType: 'event_venue', cnaes: ['8230001'] },
      { label: 'DJs', icon: Music, niches: ['dj', 'som e iluminação'], cnaes: ['9001905'] },
      { label: 'Casamentos', icon: PartyPopper, niches: ['casamento', 'cerimonial'], includedType: 'wedding_venue', cnaes: ['8230002'] },
    ],
  },
  {
    label: 'FINANÇAS',
    templates: [
      { label: 'Bancos', icon: Banknote, niches: ['banco', 'agência bancária'], includedType: 'bank', cnaes: ['6421200', '6422100'] },
      { label: 'Financeiras', icon: Banknote, niches: ['financeira', 'crédito'], cnaes: ['6431000', '6432800'] },
      { label: 'Corretoras', icon: Banknote, niches: ['corretora', 'investimentos'], cnaes: ['6612601', '6612602'] },
      { label: 'Câmbio', icon: Banknote, niches: ['câmbio', 'casa de câmbio'], cnaes: ['6619302'] },
    ],
  },
];

const DEFAULT_VISIBLE_GROUPS = 5;

function getGreeting(t: (key: string) => string): string {
  const h = new Date().getHours();
  if (h < 12) return t('dash.greeting.morning');
  if (h < 18) return t('dash.greeting.afternoon');
  return t('dash.greeting.evening');
}

export default function DashboardIndex() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useOutletContext<{ user: SessionUser }>();
  const { addToast } = useToast();
  const { setLastSearchResults } = useSearchResults();

  const [form, setForm] = useState<SearchFormValues>(() => createDefaultSearchValues());
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const [stats, setStats] = useState<LeadStats | null>(null);
  const [showUpgradeCTA, setShowUpgradeCTA] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);

  /* NEW state */
  const [searchBarQuery, setSearchBarQuery] = useState('');
  const [barSuggestions, setBarSuggestions] = useState<SearchTemplate[]>([]);
  const [barOpen, setBarOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<SearchProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [favoriteStates, setFavoriteStates] = useState<string[]>([]);
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number>(-1);
  const barRef = useRef<HTMLDivElement>(null);
  const statePickerRef = useRef<HTMLDivElement>(null);

  /* City autocomplete state (inlined from SearchFiltersRow) */
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);

  const LOADING_STEPS = useMemo(() => {
    const steps = [
      t('dash.loading.step1'),
      t('dash.loading.step2'),
      isMarketFeatureEnabled('rfSearch') ? t('dash.loading.step3') : t('dash.loading.us.step3'),
      t('dash.loading.step4'),
      t('dash.loading.step5'),
      t('dash.loading.step6'),
    ];
    return steps;
  }, [t]);

  const categoryGroups = useMemo(() => resolveSearchCategoryGroups(BR_CATEGORY_GROUPS), []);
  const allTemplates = useMemo(() => categoryGroups.flatMap((g) => g.templates), [categoryGroups]);
  const isUsSearch = !isMarketFeatureEnabled('cnae');
  const showCnaeFilters = isMarketFeatureEnabled('cnae') && form.country === 'BR';

  const quickstartSteps = useMemo(() => {
    if (isUsSearch) {
      return [
        { step: '1', title: t('dash.quickstart.us.step1Title'), desc: t('dash.quickstart.us.step1Desc') },
        { step: '2', title: t('dash.quickstart.us.step2Title'), desc: t('dash.quickstart.us.step2Desc') },
        { step: '3', title: t('dash.quickstart.us.step3Title'), desc: t('dash.quickstart.us.step3Desc') },
      ];
    }
    return [
      { step: '1', title: t('dash.quickstart.step1Title'), desc: t('dash.quickstart.step1Desc') },
      { step: '2', title: t('dash.quickstart.step2Title'), desc: t('dash.quickstart.step2Desc') },
      { step: '3', title: t('dash.quickstart.step3Title'), desc: t('dash.quickstart.step3Desc') },
    ];
  }, [t, isUsSearch]);

  const states = useMemo(() => getStatesByCountry(normalizeCountryCode(form.country)), [form.country]);
  const countryCode = normalizeCountryCode(form.country);
  const selectedCountry = useMemo(() => {
    const base = COUNTRIES.find((c) => c.value === countryCode);
    if (!base) return undefined;
    return { ...base, label: getLocalizedCountryLabel(base.value, t) };
  }, [countryCode, t]);

  /* Category/type dropdown logic */
  const categoryIndexFromType = form.includedType
    ? PLACE_TYPE_CATEGORIES.findIndex((c) => c.types.some((t) => t.value === form.includedType))
    : -1;
  const effectiveCategoryIndex = categoryIndexFromType >= 0 ? categoryIndexFromType : selectedCategoryIndex;
  const currentTypes = effectiveCategoryIndex >= 0 ? PLACE_TYPE_CATEGORIES[effectiveCategoryIndex].types : [];

  // Cycle through loading steps
  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const timer = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [loading, LOADING_STEPS.length]);

  // Pre-fill form from URL params
  useEffect(() => {
    const q = searchParams.get('q');
    if (!q) return;
    setForm((prev) => ({
      ...prev,
      advancedTerm: q,
      country: searchParams.get('country') || prev.country,
      state: searchParams.get('state') || prev.state,
      city: searchParams.get('city') || prev.city,
      includedType: searchParams.get('type') || prev.includedType,
      radiusKm: searchParams.get('radius') ? Number(searchParams.get('radius')) : prev.radiusKm,
    }));
    setSearchParams({}, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load stats & recents
  useEffect(() => {
    leadsApi.stats().then(setStats).catch(() => {});
    searchApi.history({ limit: 3 }).then((r) => setRecentSearches(r.items ?? [])).catch(() => {});
  }, []);

  // Load saved profiles
  useEffect(() => {
    const data = loadProfiles();
    setProfiles(data.profiles);
    if (data.activeId) {
      const active = data.profiles.find((p) => p.id === data.activeId);
      if (active) {
        setActiveProfileId(active.id);
        setFavoriteStates(active.states);
        setForm((prev) => ({
          ...prev,
          country: active.country,
          city: active.city || prev.city,
          state: active.states.length === 1 ? active.states[0] : 'Todos',
          radiusKm: active.radiusKm || prev.radiusKm,
        }));
      }
    }
  }, []);

  useEffect(() => {
    const onTourStep = (event: Event) => {
      const detail = (event as CustomEvent<{ target: string | null }>).detail;
      if (detail?.target !== 'quick-templates') return;
      setShowAllCategories(true);
      const firstGroup = categoryGroups[0]?.label;
      if (firstGroup) {
        setExpandedGroups((prev) => new Set([...prev, firstGroup]));
      }
    };
    window.addEventListener(TOUR_STEP_EVENT, onTourStep);
    return () => window.removeEventListener(TOUR_STEP_EVENT, onTourStep);
  }, [categoryGroups]);

  // Close search bar suggestions on outside click
  useEffect(() => {
    if (!barOpen) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setBarOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [barOpen]);

  // Close state picker on outside click
  useEffect(() => {
    if (!statePickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (statePickerRef.current && !statePickerRef.current.contains(e.target as Node)) setStatePickerOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statePickerOpen]);

  // Close city dropdown on outside click
  useEffect(() => {
    if (!cityOpen) return;
    const handler = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [cityOpen]);

  // City autocomplete API
  useEffect(() => {
    const country = form.country;
    const state = form.state;
    const q = (form.city ?? '').trim();
    if (!['BR', 'US'].includes(country) || !state || state === 'Todos' || q.length < (country === 'US' ? 2 : 3)) {
      setCitySuggestions([]);
      setCityOpen(false);
      return;
    }
    let cancelled = false;
    const tid = window.setTimeout(() => {
      searchApi.citySuggestions({ state, country, q })
        .then((res) => { if (!cancelled) { setCitySuggestions(res.cities ?? []); setCityOpen((res.cities?.length ?? 0) > 0); } })
        .catch(() => { if (!cancelled) { setCitySuggestions([]); setCityOpen(false); } });
    }, 220);
    return () => { cancelled = true; clearTimeout(tid); };
  }, [form.city, form.state, form.country]);

  /* ── Payload & validation ── */

  const payload = useMemo(
    () => {
      const effectiveState = form.state === 'Todos' && favoriteStates.length === 1
        ? favoriteStates[0]
        : form.state;

      return ({
      textQuery: '',
      country: getCountryLabel(form.country),
      countryCode: form.country,
      state: effectiveState,
      city: form.city ?? '',
      radiusKm: form.radiusKm,
      includedType: form.includedType,
      niches: form.niches,
      advancedTerm: form.advancedTerm ?? '',
      hasWebsite: form.hasWebsite,
      hasPhone: form.hasPhone,
      ...(showCnaeFilters
        ? { cnae: form.cnae, cnaeDescricao: form.cnaeDescricao, cnaes: form.cnaes }
        : {}),
      });
    },
    [form, favoriteStates, showCnaeFilters]
  );

  const validation = useMemo(() => validateSearchPayload(payload, t), [payload, t]);
  const canSearch = validation.ok;

  /* ── Handlers ── */

  const runSearch = useCallback(async () => {
    if (!validation.ok) { addToast('error', validation.message); return; }
    if ((form.advancedTerm?.trim().length ?? 0) > 0 && (form.advancedTerm?.trim().length ?? 0) < MIN_ADVANCED_TERM) {
      addToast('error', t('dash.search.validation.advancedTermMin', { min: MIN_ADVANCED_TERM }));
      return;
    }
    setLoading(true);
    try {
      const result = await startSearch(payload, t);
      const textQuery = buildTextQuery(payload);
      setLastSearchResults({
        places: result.places ?? [],
        nextPageToken: result.nextPageToken,
        params: {
          textQuery,
          includedType: payload.includedType?.trim() || undefined,
          city: payload.city?.trim() || undefined,
          state: payload.state?.trim() || undefined,
          country: payload.countryCode?.trim() || payload.country?.trim() || undefined,
          radiusKm: payload.radiusKm,
          hasWebsite: payload.hasWebsite !== 'any' ? payload.hasWebsite : undefined,
          hasPhone: payload.hasPhone !== 'any' ? payload.hasPhone : undefined,
        },
      });
      window.dispatchEvent(new Event('refresh-user'));
      addToast('success', t('dash.search.toast.resultsFound', { count: result.places.length }));
      navigate('/dashboard/resultados');
    } catch (e) {
      const message = e instanceof Error ? e.message : t('dash.search.toast.errorGeneric');
      if (message.toLowerCase().includes('limit') || message.includes('TRIAL_EXPIRED') || message.toLowerCase().includes('trial')) {
        window.dispatchEvent(new Event('refresh-user'));
        setShowUpgradeCTA(true);
        if (message.includes('TRIAL_EXPIRED') || message.toLowerCase().includes('trial')) {
          navigate('/dashboard/planos');
        }
      } else {
        addToast('error', message);
        navigate('/dashboard/resultados', { state: { error: message } });
      }
    } finally {
      setLoading(false);
    }
  }, [payload, validation, form.advancedTerm, addToast, navigate, setLastSearchResults, t]);

  const goToHistorico = useCallback(() => navigate('/dashboard/historico'), [navigate]);

  const applyTemplate = useCallback((tpl: SearchTemplate) => {
    setForm((prev) => ({
      ...prev,
      niches: tpl.niches,
      includedType: tpl.includedType,
      ...(showCnaeFilters && tpl.cnaes?.length
        ? { cnaes: tpl.cnaes, cnae: tpl.cnaes[0], cnaeDescricao: tpl.label }
        : { cnaes: [], cnae: undefined, cnaeDescricao: undefined }),
    }));
    setSearchBarQuery(tpl.label);
    setBarOpen(false);
  }, [showCnaeFilters]);

  const handleSearchBarChange = useCallback((q: string) => {
    setSearchBarQuery(q);
    if (q.trim().length < 2) { setBarSuggestions([]); setBarOpen(false); return; }
    const lower = q.toLowerCase();
    const matches = allTemplates.filter(
      (t) => t.label.toLowerCase().includes(lower) || t.niches.some((n) => n.toLowerCase().includes(lower))
    ).slice(0, 8);
    setBarSuggestions(matches);
    setBarOpen(matches.length > 0);
    // Also set as advancedTerm for free-text search
    setForm((prev) => ({ ...prev, advancedTerm: q }));
  }, [allTemplates]);

  const handleSaveProfile = useCallback(() => {
    const countryLabel = getLocalizedCountryLabel(form.country, t);
    const autoName = form.city?.trim()
      ? `${form.city.trim()} - ${countryLabel}`
      : favoriteStates.length === 1
        ? `${favoriteStates[0]} - ${countryLabel}`
        : countryLabel;

    if (activeProfileId) {
      // Update existing profile
      const updated = profiles.map((p) =>
        p.id === activeProfileId
          ? { ...p, country: form.country, states: favoriteStates, city: form.city ?? '', radiusKm: form.radiusKm }
          : p
      );
      setProfiles(updated);
      persistProfiles({ profiles: updated, activeId: activeProfileId });
      addToast('success', t('dash.profiles.updated'));
    } else {
      // Create new profile
      const newProfile: SearchProfile = {
        id: generateProfileId(),
        name: autoName,
        country: form.country,
        states: favoriteStates,
        city: form.city ?? '',
        radiusKm: form.radiusKm,
      };
      const updated = [...profiles, newProfile];
      setProfiles(updated);
      setActiveProfileId(newProfile.id);
      persistProfiles({ profiles: updated, activeId: newProfile.id });
      addToast('success', t('dash.profiles.created', { name: autoName }));
    }
  }, [activeProfileId, profiles, form.country, form.city, favoriteStates, form.radiusKm, addToast, t]);

  const handleActivateProfile = useCallback((profile: SearchProfile) => {
    setActiveProfileId(profile.id);
    setFavoriteStates(profile.states);
    setForm((prev) => ({
      ...prev,
      country: profile.country,
      city: profile.city || '',
      state: profile.states.length === 1 ? profile.states[0] : 'Todos',
      radiusKm: profile.radiusKm || prev.radiusKm,
    }));
    persistProfiles({ profiles, activeId: profile.id });
  }, [profiles]);

  const handleDeleteProfile = useCallback((id: string) => {
    const updated = profiles.filter((p) => p.id !== id);
    const newActiveId = id === activeProfileId ? null : activeProfileId;
    setProfiles(updated);
    setActiveProfileId(newActiveId);
    persistProfiles({ profiles: updated, activeId: newActiveId });
    addToast('success', t('dash.profiles.removed'));
  }, [profiles, activeProfileId, addToast, t]);

  const handleNewProfile = useCallback(() => {
    setActiveProfileId(null);
    addToast('info', t('dash.profiles.configureHint'));
  }, [addToast, t]);

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const toggleFavoriteState = useCallback((stateVal: string) => {
    setFavoriteStates((prev) =>
      prev.includes(stateVal) ? prev.filter((s) => s !== stateVal) : [...prev, stateVal]
    );
  }, []);

  const clearForm = useCallback(() => {
    setForm(createDefaultSearchValues());
    setSearchBarQuery('');
    setSelectedCategoryIndex(-1);
  }, []);

  const applyFirstSearchExample = useCallback((example: FirstSearchExample) => {
    setForm((prev) => ({
      ...prev,
      country: example.country,
      state: example.state,
      niches: example.niches,
      includedType: example.includedType,
      advancedTerm: '',
      city: '',
      cnaes: [],
      cnae: undefined,
      cnaeDescricao: undefined,
    }));
    setFavoriteStates([example.state]);
    setSearchBarQuery(example.niches[0] ?? '');
    setSelectedCategoryIndex(-1);
  }, []);

  const numberLocale = locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es' : 'en-US';
  const creditUsage = formatCreditUsage(user, numberLocale);
  const firstName = user.name?.split(' ')[0] ?? t('dash.greeting.defaultUser');
  const remainingCredits = creditUsage.remaining;
  const userNeedsSubscription = needsSubscription(user);
  const isNewUser = !stats || (stats.total === 0 && stats.searchesThisMonth === 0);
  const trialExpired = isTrialExpiredUser(user);
  const visibleGroups = showAllCategories ? categoryGroups : categoryGroups.slice(0, DEFAULT_VISIBLE_GROUPS);
  const expandAll = useCallback(() => setExpandedGroups(new Set(categoryGroups.map((g) => g.label))), [categoryGroups]);
  const collapseAll = useCallback(() => setExpandedGroups(new Set()), []);

  return (
    <>
      <HeaderDashboard
        title={`${getGreeting(t)}, ${firstName}!`}
        subtitle={t('dash.search.subtitle')}
        breadcrumb={t('dash.search.breadcrumb')}
        onHistórico={goToHistorico}
        onIniciarBusca={runSearch}
        searchLoading={loading}
        primaryDisabled={!canSearch}
      />

      <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-5" role="search"
        onKeyDown={(e) => { if (e.key === 'Enter' && canSearch && !loading && !trialExpired) { e.preventDefault(); runSearch(); } }}
      >
        {/* ── Quick start for new users ── */}
        {isNewUser && !trialExpired && (
          <section aria-label={t('dash.a11y.quickstart')} className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 to-indigo-600/5 p-5 sm:p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
                <Sparkles size={20} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">{t('dash.quickstart.title')}</h2>
                <p className="text-sm text-muted mt-1">
                  {isTrialEnabled()
                    ? t('dash.quickstart.subTrial')
                    : t('dash.quickstart.subUs', { price: US_STARTER_PRICE_USD })}
                </p>
              </div>
            </div>
            <ol className="grid sm:grid-cols-3 gap-3 text-sm">
              {quickstartSteps.map(({ step, title, desc }) => (
                <li key={step} className="rounded-xl border border-border/60 bg-card/50 p-3">
                  <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">{t('dash.quickstart.step', { n: step })}</span>
                  <p className="font-semibold text-foreground mt-1">{title}</p>
                  <p className="text-xs text-muted mt-0.5">{desc}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── Credits strip ── */}
        {!trialExpired && (
          userNeedsSubscription ? (
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl border border-violet-500/25 bg-gradient-to-r from-violet-600/10 to-indigo-600/5 text-sm">
              <span className="text-muted">{t('dash.credits.stripNoPlan', { count: US_STARTER_CREDITS })}</span>
              <Link
                to="/dashboard/planos"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:shadow-md hover:shadow-violet-600/30 transition-all"
              >
                <Sparkles size={13} />
                {t('dash.credits.subscribeCta', { count: US_STARTER_CREDITS })}
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface/50 text-sm">
              <span className="text-muted">
                <span className="font-semibold text-foreground tabular-nums">
                  {t('dash.credits.remaining', { count: creditUsage.remainingLabel })}
                </span>
                <span className="text-muted/60 mx-2">·</span>
                <span className="tabular-nums">{t('dash.credits.used', { used: creditUsage.usedLabel, limit: creditUsage.limitLabel })}</span>
              </span>
              {remainingCredits <= 10 && (
                <Link to="/dashboard/planos" className="text-violet-600 dark:text-violet-400 font-semibold text-xs hover:underline">
                  {t('dash.credits.viewPlans')}
                </Link>
              )}
            </div>
          )
        )}

        {/* ── Metrics ── */}
        {stats && (stats.total > 0 || stats.searchesThisMonth > 0) && (
          <section aria-label={t('dash.a11y.accountSummary')} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-stretch">
            {[
              { label: t('dash.stats.savedLeads'), value: stats.total, icon: Target, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
              { label: t('dash.stats.highScore'), value: stats.highScore, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
              { label: t('dash.stats.favorites'), value: stats.favorites, icon: Star, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
              { label: t('dash.stats.searchesMonth'), value: stats.searchesThisMonth, icon: SearchIcon, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`rounded-2xl border ${bg} p-4 flex items-center gap-3 min-h-[92px] h-full`}>
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                  <Icon size={18} className={color} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-black text-foreground tabular-nums leading-none">{value.toLocaleString(numberLocale)}</p>
                  <p className="text-[11px] text-muted leading-snug mt-1.5">{label}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── First search hint (new users) ── */}
        <FirstSearchHintBanner
          isNewUser={isNewUser}
          trialExpired={trialExpired}
          searchInProgress={loading}
          onApplyExample={applyFirstSearchExample}
        />

        {/* ── US search hint (persistent) ── */}
        {isUsSearch && (
          <div
            role="note"
            aria-label={t('dash.search.usHint')}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-sky-500/15 bg-sky-500/5 text-sm text-muted"
          >
            <Info size={15} className="text-sky-500 shrink-0" aria-hidden />
            <span>{t('dash.search.usHint')}</span>
          </div>
        )}

        {/* ── Unified Search Bar ── */}
        <section aria-label={t('dash.a11y.searchBar')} className="relative" ref={barRef} data-tour="nova-busca">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="text"
                placeholder={isMarketFeatureEnabled('cnae') ? t('dash.search.placeholderBr') : t('dash.search.placeholder')}
                value={searchBarQuery}
                onChange={(e) => handleSearchBarChange(e.target.value)}
                onFocus={() => { if (barSuggestions.length) setBarOpen(true); }}
                disabled={loading}
                className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 disabled:opacity-50"
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              className="h-11 px-6 text-sm font-semibold shrink-0"
              onClick={runSearch}
              disabled={!canSearch || loading}
              icon={loading ? <Loader2 size={16} className="animate-spin" /> : <SearchIcon size={16} />}
            >
              {t('dash.search.button')}
            </Button>
          </div>
          {/* Autocomplete suggestions */}
          {barOpen && barSuggestions.length > 0 && (
            <div className="absolute z-30 top-full mt-1 left-0 right-0 rounded-xl border border-border bg-surface shadow-xl max-h-64 overflow-y-auto">
              {barSuggestions.map((tpl) => {
                const Icon = tpl.icon;
                return (
                  <button
                    key={tpl.label}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-violet-600/10 transition-colors text-left"
                    onClick={() => applyTemplate(tpl)}
                  >
                    <Icon size={16} className="text-violet-500 shrink-0" />
                    <span>{tpl.label}</span>
                    <span className="ml-auto text-[10px] text-muted">{tpl.niches[0]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Search Profiles ── */}
        {(profiles.length > 0 || activeProfileId) && (
          <section aria-label={t('dash.profiles.label')} className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted">{t('dash.profiles.label')}:</span>
            {profiles.map((p) => {
              const isActive = p.id === activeProfileId;
              const flag = COUNTRIES.find((c) => c.value === p.country)?.flag ?? '';
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                    isActive
                      ? 'bg-violet-600/15 border-violet-500/40 text-violet-600 dark:text-violet-400'
                      : 'border-border bg-surface hover:bg-violet-600/10 hover:border-violet-500/30 text-foreground'
                  )}
                >
                  <button type="button" onClick={() => handleActivateProfile(p)} className="flex items-center gap-1">
                    {flag} {p.name}
                  </button>
                  <X
                    size={10}
                    className="text-muted hover:text-red-500 ml-0.5 cursor-pointer"
                    onClick={() => handleDeleteProfile(p.id)}
                  />
                </div>
              );
            })}
            {activeProfileId && (
              <button
                type="button"
                onClick={handleNewProfile}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-violet-500/30 text-violet-500 hover:bg-violet-600/10 transition-colors"
              >
                {t('dash.profiles.new')}
              </button>
            )}
          </section>
        )}

        {/* ── Location pills ── */}
        <section aria-label={t('dash.location.label')} className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted">{t('dash.location.label')}:</span>
          {/* Country pill */}
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-600/15 border border-violet-500/40 text-xs font-semibold text-violet-600 dark:text-violet-400">
            {selectedCountry?.label ?? getLocalizedCountryLabel(countryCode, t)}
          </span>
          {/* Favorite state pills */}
          {favoriteStates.map((sv) => {
            const sl = states.find((s: StateOption) => s.value === sv);
            const isActive = form.state === sv;
            return (
              <button
                key={sv}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, state: prev.state === sv ? 'Todos' : sv }))}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                  isActive
                    ? 'bg-violet-600/15 border-violet-500/40 text-violet-600 dark:text-violet-400'
                    : 'border-border bg-surface hover:bg-violet-600/10 hover:border-violet-500/30 text-foreground'
                )}
              >
                {getStateLabel(countryCode, sv) || (sl?.label ?? sv)}
                <X size={10} className="text-muted hover:text-red-500 ml-0.5" onClick={(e) => { e.stopPropagation(); toggleFavoriteState(sv); }} />
              </button>
            );
          })}
          {/* Add state pill */}
          <div className="relative" ref={statePickerRef}>
            <button
              type="button"
              onClick={() => setStatePickerOpen((p) => !p)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-violet-500/30 text-violet-500 hover:bg-violet-600/10 transition-colors"
            >
              {t('dash.location.otherStates')}
            </button>
            {statePickerOpen && (
              <div className="absolute z-20 top-full mt-1 left-0 rounded-xl border border-border bg-surface shadow-xl w-56 max-h-60 overflow-y-auto">
                {states.filter((s: StateOption) => s.value !== 'Todos').map((s: StateOption) => (
                  <button
                    key={s.value}
                    type="button"
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs hover:bg-violet-600/10 transition-colors flex items-center justify-between',
                      favoriteStates.includes(s.value) && 'bg-violet-600/5 font-semibold'
                    )}
                    onClick={() => { toggleFavoriteState(s.value); }}
                  >
                    <span>{s.label}</span>
                    {favoriteStates.includes(s.value) && <span className="text-violet-500">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Country selector */}
          <select
            value={form.country}
            onChange={(e) => {
              const nextCountry = e.target.value;
              setForm((prev) => ({
                ...prev,
                country: nextCountry,
                state: 'Todos',
                city: '',
                ...(nextCountry !== 'BR' || !isMarketFeatureEnabled('cnae')
                  ? { cnaes: [], cnae: undefined, cnaeDescricao: undefined }
                  : {}),
              }));
              setFavoriteStates([]);
            }}
            className="h-7 rounded-lg border border-border bg-surface px-2 text-[10px] font-medium text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>{c.flag} {getLocalizedCountryLabel(c.value, t)}</option>
            ))}
          </select>
          {/* Save profile */}
          <button
            type="button"
            onClick={handleSaveProfile}
            className="p-1.5 rounded-lg text-violet-500 hover:bg-violet-600/10 transition-colors"
            title={activeProfileId ? t('dash.profiles.saveCurrent') : t('dash.profiles.createNew')}
          >
            <Save size={14} />
          </button>
        </section>

        {/* ── Compact filter row ── */}
        <section aria-label={t('dash.a11y.filters')} className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="search-filters">
          {/* Cidade */}
          <div className="relative" ref={cityRef}>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">{t('dash.filters.cityLabel')}</label>
            <input
              type="text"
              placeholder={t('dash.search.cityPlaceholder')}
              value={form.city ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              disabled={loading}
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
            />
            {cityOpen && citySuggestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 rounded-lg border border-border bg-surface shadow-xl max-h-40 overflow-y-auto">
                {citySuggestions.map((c) => (
                  <button key={c} type="button" className="w-full text-left px-3 py-2 text-xs hover:bg-violet-600/10" onClick={() => { setForm((prev) => ({ ...prev, city: c })); setCityOpen(false); }}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Categoria */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">{t('dash.filters.categoryLabel')}</label>
            <select
              value={effectiveCategoryIndex >= 0 ? effectiveCategoryIndex : ''}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedCategoryIndex(v === '' ? -1 : Number(v));
                setForm((prev) => ({ ...prev, includedType: undefined }));
              }}
              disabled={loading}
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
            >
              <option value="">{t('dash.filters.allCategories')}</option>
              {PLACE_TYPE_CATEGORIES.map((cat, idx) => <option key={cat.label} value={idx}>{cat.label}</option>)}
            </select>
          </div>
          {/* Tipo / Segmento */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">{t('dash.filters.segmentLabel')}</label>
            <select
              value={form.includedType ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, includedType: e.target.value || undefined }))}
              disabled={loading || effectiveCategoryIndex < 0}
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-50"
            >
              <option value="">{t('dash.filters.allTypes')}</option>
              {currentTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {/* Raio */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1 block">{t('dash.filters.radiusLabel')}</label>
            <div className="flex gap-1.5 h-9 items-center">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={loading}
                  onClick={() => setForm((prev) => ({ ...prev, radiusKm: r }))}
                  className={cn(
                    'flex-1 h-8 rounded-lg text-xs font-semibold transition-colors',
                    form.radiusKm === r
                      ? 'bg-violet-600 text-white'
                      : 'bg-surface border border-border text-muted hover:border-violet-500/30'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Category shortcuts (collapsible) ── */}
        <section aria-label={t('dash.categories.shortcuts')} data-tour="quick-templates" className="rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-foreground">{t('dash.categories.shortcuts')}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAllCategories((p) => !p)}
                className="text-[11px] text-violet-500 hover:text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1 transition-colors"
              >
                {showAllCategories ? t('dash.categories.showLess') : t('dash.categories.showAll')} <ArrowRight size={10} />
              </button>
              <button
                type="button"
                onClick={expandedGroups.size > 0 ? collapseAll : expandAll}
                className="text-[11px] text-muted hover:text-violet-500 font-medium transition-colors"
              >
                {expandedGroups.size > 0 ? t('dash.categories.collapseAll') : t('dash.categories.expandAll')}
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {visibleGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.label);
              return (
                <div key={group.label} className="rounded-lg border border-border/50">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface/80 transition-colors rounded-lg"
                  >
                    {isExpanded ? <ChevronDown size={12} className="text-muted shrink-0" /> : <ChevronRight size={12} className="text-muted shrink-0" />}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{group.label}</span>
                    <span className="text-[10px] text-muted/50 ml-1">({group.templates.length})</span>
                  </button>
                  {isExpanded && (
                    <div className="flex gap-2 flex-wrap px-3 pb-3">
                      {group.templates.map((tpl) => {
                        const Icon = tpl.icon;
                        const isActive = tpl.includedType
                          ? form.includedType === tpl.includedType
                          : form.niches.length > 0 && tpl.niches.every((n) => form.niches.includes(n));
                        return (
                          <button
                            key={tpl.label}
                            type="button"
                            onClick={() => applyTemplate(tpl)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                              isActive
                                ? 'bg-violet-600/15 border-violet-500/40 text-violet-600 dark:text-violet-400'
                                : 'border-border bg-surface hover:bg-violet-600/10 hover:border-violet-500/30 text-foreground'
                            )}
                          >
                            <Icon size={14} className={isActive ? 'text-violet-600 dark:text-violet-400' : 'text-violet-500'} aria-hidden />
                            {tpl.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Recent searches ── */}
        {recentSearches.length > 0 && (
          <section aria-label={t('dash.filters.recentSearches')}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted font-medium flex items-center gap-1.5">
                <Clock size={12} className="text-muted" />
                {t('dash.filters.recentSearches')}
              </p>
              <Link to="/dashboard/historico" className="text-[10px] text-violet-500 hover:text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1 transition-colors">
                {t('dash.filters.seeAll')} <ArrowRight size={10} />
              </Link>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {recentSearches.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      advancedTerm: s.textQuery,
                      city: s.city ?? prev.city,
                      state: s.state ?? prev.state,
                      includedType: (s.filters as Record<string, string> | undefined)?.includedType || prev.includedType,
                    }));
                    setSearchBarQuery(s.textQuery);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface/50 hover:bg-violet-600/10 hover:border-violet-500/30 transition-colors shrink-0 max-w-[240px]"
                  title={s.textQuery}
                >
                  <SearchIcon size={12} className="text-muted shrink-0" />
                  <span className="text-xs text-foreground truncate">{s.textQuery}</span>
                  <span className="text-[10px] text-muted tabular-nums shrink-0">{s.resultsCount}r</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Collapsible advanced filters ── */}
        <section aria-label={t('dash.filters.advancedUs')} className="border border-border rounded-xl" data-tour="advanced-filters">
          <button
            type="button"
            onClick={() => setAdvancedOpen((p) => !p)}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-medium text-foreground hover:bg-surface/80 transition-colors rounded-xl"
          >
            {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>{isMarketFeatureEnabled('cnae') ? t('dash.filters.advancedBr') : t('dash.filters.advancedUs')}</span>
            {(form.cnaes?.length ?? 0) > 0 && showCnaeFilters && (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-violet-600/15 text-violet-600 dark:text-violet-400 text-[10px] font-semibold">
                {t('dash.filters.cnaeBadge', { count: form.cnaes?.length ?? 0 })}
              </span>
            )}
            {form.hasWebsite !== 'any' && (
              <span className="px-2 py-0.5 rounded-full bg-violet-600/15 text-violet-600 dark:text-violet-400 text-[10px] font-semibold">{t('dash.filters.website')}</span>
            )}
            {form.hasPhone !== 'any' && (
              <span className="px-2 py-0.5 rounded-full bg-violet-600/15 text-violet-600 dark:text-violet-400 text-[10px] font-semibold">{t('dash.filters.phone')}</span>
            )}
          </button>
          {advancedOpen && (
            <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
              {/* CNAE — BR market only */}
              {showCnaeFilters && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 size={14} className="text-violet-500 shrink-0" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{t('dash.filters.cnaeTitle')}</span>
                    <span className="text-[10px] text-muted/60 italic">{t('dash.filters.cnaeSource')}</span>
                  </div>
                  <CnaeAutocomplete
                    values={form.cnaes ?? []}
                    onChange={(codes, desc) => setForm((prev) => ({ ...prev, cnaes: codes, cnae: codes[0], cnaeDescricao: desc }))}
                    disabled={loading}
                  />
                </div>
              )}
              {/* Website + Phone filters */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-violet-500 shrink-0" aria-hidden />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{t('dash.filters.websiteLabel')}</span>
                  {(['any', 'yes', 'no'] as const).map((opt) => (
                    <button
                      key={`web-${opt}`}
                      type="button"
                      disabled={loading}
                      onClick={() => setForm((prev) => ({ ...prev, hasWebsite: opt }))}
                      className={cn(
                        'h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30',
                        form.hasWebsite === opt
                          ? 'bg-violet-600 text-white'
                          : 'bg-surface border border-border text-muted hover:border-violet-500/30 hover:text-foreground'
                      )}
                    >
                      {opt === 'any' ? t('dash.filters.all') : opt === 'yes' ? t('dash.filters.withWebsite') : t('dash.filters.withoutWebsite')}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-violet-500 shrink-0" aria-hidden />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">{t('dash.filters.phoneLabel')}</span>
                  {(['any', 'yes', 'no'] as const).map((opt) => (
                    <button
                      key={`phone-${opt}`}
                      type="button"
                      disabled={loading}
                      onClick={() => setForm((prev) => ({ ...prev, hasPhone: opt }))}
                      className={cn(
                        'h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/30',
                        form.hasPhone === opt
                          ? 'bg-violet-600 text-white'
                          : 'bg-surface border border-border text-muted hover:border-violet-500/30 hover:text-foreground'
                      )}
                    >
                      {opt === 'any' ? t('dash.filters.all') : opt === 'yes' ? t('dash.filters.withPhone') : t('dash.filters.withoutPhone')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Footer: Clear + Help + CTA ── */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2" aria-label={t('dash.a11y.actions')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearForm}
            className="text-xs"
          >
            {t('dash.filters.clear')}
          </Button>
          <span className="text-xs text-muted text-center hidden sm:block">
            {t('dash.filters.configureHint')}
          </span>
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium text-foreground animate-pulse">{LOADING_STEPS[loadingStep]}</p>
            </div>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="min-w-[200px] h-11 px-8 text-sm font-bold shadow-lg shadow-violet-600/25"
              icon={<SearchIcon size={18} />}
              onClick={runSearch}
              disabled={!canSearch || loading}
            >
              {t('dash.search.buttonNow')}
            </Button>
          )}
        </section>
      </div>

      {showUpgradeCTA && (
        <UpgradeCTAModal
          currentPlan={user.plan}
          leadsUsed={user.leadsUsed}
          leadsLimit={user.leadsLimit}
          onClose={() => setShowUpgradeCTA(false)}
        />
      )}
    </>
  );
}
