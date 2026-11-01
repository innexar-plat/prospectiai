import type { CompanyStatsPage } from './seo-company-stats';

export function fmt(n: number): string;
export function pageTitle(p: CompanyStatsPage): string;
export function pageDescription(p: CompanyStatsPage): string;
export function pageFaq(p: CompanyStatsPage): Array<{ q: string; a: string }>;
export function cityHubTitle(city: string, uf: string, total: number): string;
export function cityHubDescription(city: string, uf: string, total: number, segments: number): string;
export function segmentHubTitle(segmentName: string): string;
export function segmentHubDescription(segmentName: string, cities: number, total: number): string;
export const HUB_TITLE: string;
export const HUB_DESCRIPTION: string;
