const { getModulesForPlan, planHasModule, MODULE_KEYS, MODULES, PLAN_MODULES } = require('@/lib/product-modules');

describe('product-modules lib', () => {
  it('MODULE_KEYS has 6 entries', () => {
    expect(MODULE_KEYS).toHaveLength(6);
    expect(MODULE_KEYS).toContain('MAPEAMENTO');
    expect(MODULE_KEYS).toContain('INTELIGENCIA_LEADS');
  });
  it('getModulesForPlan FREE returns 2 modules', () => {
    const mods = getModulesForPlan('FREE');
    expect(mods).toContain('MAPEAMENTO');
    expect(mods).toContain('INTELIGENCIA_LEADS');
    expect(mods).toHaveLength(2);
  });
  it('getModulesForPlan PRO includes ACAO_COMERCIAL and ANALISE_CONCORRENCIA', () => {
    const mods = getModulesForPlan('PRO');
    expect(mods).toContain('ACAO_COMERCIAL');
    expect(mods).toContain('ANALISE_CONCORRENCIA');
  });
  it('getModulesForPlan unknown falls back to FREE', () => {
    const mods = getModulesForPlan('UNKNOWN_PLAN');
    expect(mods).toEqual(PLAN_MODULES.FREE);
  });
  it('planHasModule FREE has MAPEAMENTO', () => {
    expect(planHasModule('FREE', 'MAPEAMENTO')).toBe(true);
  });
  it('planHasModule FREE does not have INTELIGENCIA_MERCADO', () => {
    expect(planHasModule('FREE', 'INTELIGENCIA_MERCADO')).toBe(false);
  });
});
