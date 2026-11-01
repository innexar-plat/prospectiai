import { useState } from 'react';
import { BrainCircuit, CalendarCheck, Check, KanbanSquare, MessagesSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const SLIDES = [
  {
    id: 'hoje',
    icon: CalendarCheck,
    tab: 'Rotina do dia',
    title: 'Abra o sistema e saiba exatamente quem contatar hoje',
    points: ['Follow-ups atrasados e do dia em primeiro lugar', 'Os melhores leads ainda não contatados', 'WhatsApp em um clique, com a próxima mensagem escrita pela IA'],
    src: '/landing/produto-hoje.webp',
    alt: 'Tela "Hoje" da Precision com a lista de follow-ups e leads quentes do dia',
  },
  {
    id: 'analise',
    icon: BrainCircuit,
    tab: 'Análise com IA',
    title: 'Cada empresa vem com nota, dados da Receita e roteiro de abordagem',
    points: ['Nota de oportunidade e chance de fechamento', 'CNPJ, situação, CNAE e contatos verificados', 'Roteiro de venda: por que agora, abertura, objeções e fechamento'],
    src: '/landing/produto-analise.webp',
    alt: 'Análise de um lead na Precision com nota 84, dados da Receita Federal e ações rápidas',
  },
  {
    id: 'crm',
    icon: KanbanSquare,
    tab: 'CRM',
    title: 'Funil de vendas completo, dentro da mesma ferramenta',
    points: ['Arraste negociações entre as etapas', 'Receita prevista ponderada por etapa', 'Taxa de ganho, ciclo médio e tarefas atrasadas'],
    src: '/landing/produto-crm.webp',
    alt: 'CRM da Precision em formato Kanban com etapas, valores e receita prevista',
  },
  {
    id: 'negociacao',
    icon: MessagesSquare,
    tab: 'Negociação',
    title: 'Todo o histórico do cliente em um só lugar',
    points: ['Notas, ligações, WhatsApp, e-mails e reuniões', 'Tarefas com data e lembrete', 'Ganhou ou perdeu? Registre o motivo e aprenda'],
    src: '/landing/produto-crm-deal.webp',
    alt: 'Ficha de uma negociação no CRM da Precision com histórico de atividades',
  },
] as const;

/** Real product screens (demo data) — replaces placeholder video cards on the landing. */
export function ProductTour() {
  const [active, setActive] = useState(0);
  const slide = SLIDES[active]!;
  return (
    <div>
      <div role="tablist" aria-label="Telas do sistema" className="mb-6 flex flex-wrap justify-center gap-2">
        {SLIDES.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              role="tab"
              type="button"
              aria-selected={i === active}
              aria-controls={`tour-panel-${s.id}`}
              onClick={() => setActive(i)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                i === active ? 'bg-violet-600 text-white shadow-md' : 'border border-border bg-card text-foreground hover:border-violet-500/40',
              )}
            >
              <Icon size={16} aria-hidden /> {s.tab}
            </button>
          );
        })}
      </div>
      <div id={`tour-panel-${slide.id}`} role="tabpanel" className="grid items-center gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="order-2 lg:order-1">
          <h3 className="text-2xl md:text-3xl font-black text-foreground">{slide.title}</h3>
          <ul className="mt-5 space-y-3">
            {slide.points.map((p) => (
              <li key={p} className="flex gap-3 text-muted">
                <Check size={18} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden /> <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <figure className="order-1 lg:order-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-border bg-surface/60 px-4 py-2.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 truncate rounded-md bg-card px-3 py-0.5 text-[11px] text-muted">precisionia.com.br/dashboard</span>
            </div>
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              width={1600}
              height={1000}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full animate-in fade-in duration-300"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted">Telas reais do sistema, com dados de demonstração.</figcaption>
        </figure>
      </div>
    </div>
  );
}
