import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportToCSV, exportToJSON, flattenForExport } from './exportService';

describe('exportService', () => {
  describe('exportToCSV', () => {
    it('does nothing when data is empty', () => {
      const appendChild = vi.fn();
      const removeChild = vi.fn();
      vi.stubGlobal('document', { body: { appendChild, removeChild }, createElement: vi.fn(() => ({ href: '', download: '', click: vi.fn() })) });
      exportToCSV([], 'test');
      expect(appendChild).not.toHaveBeenCalled();
    });

    it('builds CSV and triggers download when data has rows', () => {
      const click = vi.fn();
      const createObjectURL = vi.fn(() => 'blob:csv');
      const revokeObjectURL = vi.fn();
      const createElement = vi.fn(() => ({ href: '', download: '', click }));
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
      vi.stubGlobal('document', { body: { appendChild: vi.fn(), removeChild: vi.fn() }, createElement });
      exportToCSV([{ a: 'x', b: 'y' }], 'out');
      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    });
  });

  describe('flattenForExport', () => {
    it('maps items to flat export shape', () => {
      const items = [
        { displayName: { text: 'Foo' }, formattedAddress: 'Rua 1', name: 'Bar', rating: 4.5, types: ['a', 'b'] },
      ];
      const out = flattenForExport(items as unknown as Record<string, unknown>[]);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ nome: 'Foo', endereco: 'Rua 1', avaliacao: 4.5 });
      expect(out[0]!.tipo).toBe('a; b');
    });

    it('uses fallbacks when displayName or address missing', () => {
      const items = [{ name: 'Baz', address: 'Addr' }];
      const out = flattenForExport(items as unknown as Record<string, unknown>[]);
      expect(out[0]!.nome).toBe('Baz');
      expect(out[0]!.endereco).toBe('Addr');
    });
  });

  describe('exportToJSON', () => {
    let createObjectURL: ReturnType<typeof vi.fn>;
    let revokeObjectURL: ReturnType<typeof vi.fn>;
    let click: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      click = vi.fn();
      createObjectURL = vi.fn(() => 'blob:mock');
      revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
      vi.stubGlobal('document', {
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        createElement: vi.fn(() => ({ href: '', download: '', click })),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('creates blob and triggers download with .json filename', () => {
      exportToJSON([{ a: 1 }], 'data');
      expect(createObjectURL).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
      expect(click).toHaveBeenCalled();
    });
  });
});
