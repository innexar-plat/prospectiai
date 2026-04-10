import { z } from 'zod';

const MIN_ADVANCED_TERM = 3;

export const searchFormSchema = z.object({
  country: z.string().min(1, 'Selecione um país').default('BR'),
  state: z.string().default('Todos'),
  city: z.string().default(''),
  radiusKm: z.number().min(5).max(100).default(20),
  /** Google Place type (Table A) para filtro includedType; opcional se termo avançado preenchido */
  includedType: z.string().max(100).optional(),
  niches: z.array(z.string()).default([]),
  advancedTerm: z
    .string()
    .optional()
    .refine((v) => !v || v.trim().length === 0 || v.trim().length >= MIN_ADVANCED_TERM, {
      message: `Termo avançado deve ter no mínimo ${MIN_ADVANCED_TERM} caracteres`,
    }),
  hasWebsite: z.enum(['any', 'yes', 'no']).default('any'),
  hasPhone: z.enum(['any', 'yes', 'no']).default('any'),
  /** CNAE code filter — 7-digit code from Receita Federal */
  cnae: z.string().max(7).optional(),
  cnaeDescricao: z.string().optional(),
  /** Multiple CNAE codes for broader RF search */
  cnaes: z.array(z.string().max(7)).max(10).default([]),
});

export type SearchFormValues = z.infer<typeof searchFormSchema>;

export const DEFAULT_SEARCH_VALUES: SearchFormValues = {
  country: 'BR',
  state: 'Todos',
  city: '',
  radiusKm: 20,
  includedType: undefined,
  niches: [],
  advancedTerm: '',
  hasWebsite: 'any',
  hasPhone: 'any',
  cnae: undefined,
  cnaeDescricao: undefined,
  cnaes: [],
};
