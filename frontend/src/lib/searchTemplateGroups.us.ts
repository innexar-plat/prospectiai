import {
    Stethoscope, Heart, Pill, Dumbbell, Activity, UtensilsCrossed, Coffee, Pizza,
    Utensils, Warehouse, Scissors, Sparkles, Waves, Scale, Building2, Megaphone,
    ShieldCheck, Laptop, ShoppingBag, PawPrint, Shirt, Gem, Eye, Baby, BookOpen,
    Wrench, Car, GraduationCap, Globe, Hotel, Plane, HardHat, Hammer, Zap,
    type LucideIcon,
} from 'lucide-react';
import { getActiveMarket, isMarketFeatureEnabled } from '@/lib/market';

export interface SearchTemplate {
    label: string;
    icon: LucideIcon;
    niches: string[];
    includedType?: string;
    cnaes?: string[];
}

export interface CategoryGroup {
    label: string;
    templates: SearchTemplate[];
}

/** US market templates — English labels, Google Place types, no CNAE. */
export const US_CATEGORY_GROUPS: CategoryGroup[] = [
    {
        label: 'HEALTH & WELLNESS',
        templates: [
            { label: 'Medical Clinics', icon: Stethoscope, niches: ['medical clinic', 'doctor office'], includedType: 'doctor' },
            { label: 'Dentists', icon: Heart, niches: ['dentist', 'dental office'], includedType: 'dentist' },
            { label: 'Pharmacies', icon: Pill, niches: ['pharmacy', 'drugstore'], includedType: 'pharmacy' },
            { label: 'Gyms', icon: Dumbbell, niches: ['gym', 'fitness center'], includedType: 'gym' },
            { label: 'Physical Therapy', icon: Activity, niches: ['physical therapy', 'physiotherapy'], includedType: 'physiotherapist' },
            { label: 'Hospitals', icon: Stethoscope, niches: ['hospital'], includedType: 'hospital' },
        ],
    },
    {
        label: 'FOOD & BEVERAGE',
        templates: [
            { label: 'Restaurants', icon: UtensilsCrossed, niches: ['restaurant'], includedType: 'restaurant' },
            { label: 'Cafes', icon: Coffee, niches: ['cafe', 'coffee shop'], includedType: 'cafe' },
            { label: 'Pizza', icon: Pizza, niches: ['pizza restaurant'], includedType: 'pizza_restaurant' },
            { label: 'Bakeries', icon: Utensils, niches: ['bakery'], includedType: 'bakery' },
            { label: 'Bars', icon: Coffee, niches: ['bar', 'pub'], includedType: 'bar' },
            { label: 'Supermarkets', icon: Warehouse, niches: ['supermarket', 'grocery store'], includedType: 'supermarket' },
        ],
    },
    {
        label: 'BEAUTY',
        templates: [
            { label: 'Hair Salons', icon: Scissors, niches: ['hair salon', 'beauty salon'], includedType: 'beauty_salon' },
            { label: 'Barbershops', icon: Scissors, niches: ['barbershop'], includedType: 'barber_shop' },
            { label: 'Spas', icon: Waves, niches: ['spa', 'day spa'], includedType: 'spa' },
            { label: 'Skin Care', icon: Sparkles, niches: ['skin care clinic', 'med spa'], includedType: 'skin_care_clinic' },
        ],
    },
    {
        label: 'PROFESSIONAL SERVICES',
        templates: [
            { label: 'Law Firms', icon: Scale, niches: ['law firm', 'attorney'], includedType: 'lawyer' },
            { label: 'Accounting', icon: Building2, niches: ['accounting firm', 'CPA'], includedType: 'accounting' },
            { label: 'Real Estate', icon: Building2, niches: ['real estate agency'], includedType: 'real_estate_agency' },
            { label: 'Marketing Agencies', icon: Megaphone, niches: ['marketing agency', 'digital marketing'], includedType: 'marketing_consultant' },
            { label: 'Insurance', icon: ShieldCheck, niches: ['insurance agency'], includedType: 'insurance_agency' },
            { label: 'Coworking', icon: Laptop, niches: ['coworking space'], includedType: 'coworking_space' },
        ],
    },
    {
        label: 'RETAIL',
        templates: [
            { label: 'Retail Stores', icon: ShoppingBag, niches: ['retail store', 'shop'], includedType: 'store' },
            { label: 'Pet Stores', icon: PawPrint, niches: ['pet store', 'pet shop'], includedType: 'pet_store' },
            { label: 'Clothing', icon: Shirt, niches: ['clothing store', 'boutique'], includedType: 'clothing_store' },
            { label: 'Jewelry', icon: Gem, niches: ['jewelry store'], includedType: 'jewelry_store' },
            { label: 'Opticians', icon: Eye, niches: ['optician', 'eyewear store'] },
            { label: 'Bookstores', icon: BookOpen, niches: ['bookstore'], includedType: 'book_store' },
        ],
    },
    {
        label: 'AUTOMOTIVE',
        templates: [
            { label: 'Auto Repair', icon: Wrench, niches: ['auto repair', 'mechanic'], includedType: 'car_repair' },
            { label: 'Car Wash', icon: Car, niches: ['car wash'], includedType: 'car_wash' },
            { label: 'Car Dealers', icon: Car, niches: ['car dealer'], includedType: 'car_dealer' },
            { label: 'Gas Stations', icon: Car, niches: ['gas station'], includedType: 'gas_station' },
        ],
    },
    {
        label: 'EDUCATION',
        templates: [
            { label: 'Schools', icon: GraduationCap, niches: ['school', 'private school'], includedType: 'school' },
            { label: 'Universities', icon: GraduationCap, niches: ['university', 'college'], includedType: 'university' },
            { label: 'Language Schools', icon: Globe, niches: ['language school', 'english school'] },
            { label: 'Daycare', icon: Baby, niches: ['daycare', 'preschool'], includedType: 'preschool' },
        ],
    },
    {
        label: 'HOSPITALITY',
        templates: [
            { label: 'Hotels', icon: Hotel, niches: ['hotel'], includedType: 'hotel' },
            { label: 'Travel Agencies', icon: Plane, niches: ['travel agency'], includedType: 'travel_agency' },
        ],
    },
    {
        label: 'HOME SERVICES',
        templates: [
            { label: 'Contractors', icon: HardHat, niches: ['general contractor', 'construction'], includedType: 'general_contractor' },
            { label: 'Hardware Stores', icon: Hammer, niches: ['hardware store'], includedType: 'hardware_store' },
            { label: 'Electricians', icon: Zap, niches: ['electrician'], includedType: 'electrician' },
            { label: 'Plumbers', icon: Wrench, niches: ['plumber'], includedType: 'plumber' },
        ],
    },
    {
        label: 'TECH',
        templates: [
            { label: 'Software Companies', icon: Laptop, niches: ['software company', 'IT services'] },
            { label: 'Web Agencies', icon: Globe, niches: ['web design agency', 'web development'] },
            { label: 'Electronics', icon: Laptop, niches: ['electronics store'], includedType: 'electronics_store' },
        ],
    },
];

/**
 * Returns search template groups for the current market.
 * BR templates are defined inline in DashboardIndex (with CNAE).
 * US templates use this module.
 */
export function resolveSearchCategoryGroups(brGroups: CategoryGroup[]): CategoryGroup[] {
    return getActiveMarket() === 'US' ? US_CATEGORY_GROUPS : brGroups;
}

export function useUsMarketTemplates(): boolean {
    return !isMarketFeatureEnabled('cnae');
}
