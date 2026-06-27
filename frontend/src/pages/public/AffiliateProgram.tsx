import React, { useState } from 'react';
import { CheckCircle2, DollarSign, TrendingUp, Zap } from 'lucide-react';

/**
 * Affiliate Program Landing Page
 * Location: /afiliados
 * 
 * Features:
 * - Info about the program
 * - Registration form
 * - Real-time earnings calculator
 * - FAQ
 */

export default function AffiliateProgram() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    website: '',
    followers: '',
    description: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [monthlyClients, setMonthlyClients] = useState(5);

  const plans = [
    { name: 'Starter', price: 129, commission: 25.8 },
    { name: 'Growth', price: 397, commission: 79.4 },
    { name: 'Business', price: 997, commission: 199.4 },
    { name: 'Enterprise', price: 2497, commission: 499.4 },
  ];

  const avgCommission = (plans.reduce((sum, p) => sum + p.commission, 0) / plans.length).toFixed(2);
  const estimatedMonthly = (parseFloat(avgCommission) * monthlyClients).toFixed(2);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Submit to API
    setSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero */}
      <section className="px-4 py-16 sm:py-24 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Ganhe com Prospector AI</h1>
          <p className="text-xl text-violet-100 mb-8">
            Indique a plataforma e ganhe 20% de comissão recorrente de cada cliente. Sem limite de ganho.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
            <div className="bg-white/10 backdrop-blur p-6 rounded-lg">
              <Zap className="w-8 h-8 mx-auto mb-3" />
              <p className="font-semibold">Comissão Recorrente</p>
              <p className="text-violet-100 text-sm mt-1">20% lifetime</p>
            </div>
            <div className="bg-white/10 backdrop-blur p-6 rounded-lg">
              <TrendingUp className="w-8 h-8 mx-auto mb-3" />
              <p className="font-semibold">Ganhos Previsíveis</p>
              <p className="text-violet-100 text-sm mt-1">Não expira</p>
            </div>
            <div className="bg-white/10 backdrop-blur p-6 rounded-lg">
              <DollarSign className="w-8 h-8 mx-auto mb-3" />
              <p className="font-semibold">Pagamento Rápido</p>
              <p className="text-violet-100 text-sm mt-1">Todo mês</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">Como Funciona</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Inscreva-se', desc: 'Preencha o formulário e seja aprovado em 48h' },
            { step: '2', title: 'Compartilhe', desc: 'Use seu link único em posts, newsletters, contatos' },
            { step: '3', title: 'Rastreie', desc: 'Veja clicks, conversões e ganhos em tempo real' },
            { step: '4', title: 'Saque', desc: 'Receba via PIX no 15º dia útil de cada mês' },
          ].map((item, idx) => (
            <div key={idx} className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center">
              <div className="w-10 h-10 bg-violet-600 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-4">
                {item.step}
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Earnings Calculator */}
      <section className="px-4 py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">Calcule Seus Ganhos</h2>

          <div className="bg-white rounded-lg shadow-lg p-8 border border-slate-200">
            <div className="mb-8">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Quantos clientes você quer indicar por mês?
              </label>
              <input
                type="range"
                min="1"
                max="50"
                value={monthlyClients}
                onChange={(e) => setMonthlyClients(parseInt(e.target.value))}
                className="w-full h-2 bg-violet-200 rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-center text-2xl font-bold text-violet-600 mt-4">{monthlyClients} clientes/mês</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className="bg-gradient-to-br from-violet-50 to-indigo-50 p-6 rounded-lg border border-violet-200">
                <p className="text-sm text-slate-600 mb-2">Comissão média por cliente</p>
                <p className="text-3xl font-bold text-violet-600">R$ {avgCommission}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                <p className="text-sm text-slate-600 mb-2">Ganho mensal estimado</p>
                <p className="text-3xl font-bold text-green-600">R$ {estimatedMonthly}</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm text-amber-800 mb-6">
              <p className="font-semibold mb-1">✨ Bônus: Comissão é recorrente!</p>
              <p>Se hoje você indicar 10 clientes, próximo mês receives 20 clientes de comissão (10 novos + 10 antigos).</p>
            </div>

            {/* Commission Breakdown */}
            <div className="mt-8 pt-8 border-t border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4">Comissão por Plano (20%)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {plans.map((plan) => (
                  <div key={plan.name} className="bg-slate-50 p-4 rounded-lg text-center">
                    <p className="font-semibold text-slate-700">{plan.name}</p>
                    <p className="text-2xl font-bold text-violet-600 mt-2">R$ {plan.commission.toFixed(2)}</p>
                    <p className="text-xs text-slate-500 mt-1">de R$ {plan.price}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="px-4 py-16 max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4 text-slate-900">Inscrever-se</h2>
        <p className="text-center text-slate-600 mb-12">
          Preencha o formulário abaixo. Avaliaremos sua aplicação em até 48h.
        </p>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-green-900 mb-2">Inscrição Enviada!</h3>
            <p className="text-green-700">
              Usamos verificar sua aplicação e entraremos em contato por email em até 48h.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Enviar Outra Inscrição
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8 border border-slate-200">
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nome Completo *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="Seu nome"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email *</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="seu@email.com"
                />
              </div>

              {/* Website/Social */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Site ou Rede Social *</label>
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="https://linkedin.com/in/seu-perfil"
                />
              </div>

              {/* Followers */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Seguidores / Assinantes</label>
                <input
                  type="number"
                  name="followers"
                  value={formData.followers}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Por que você é um bom afiliado? *
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  placeholder="Conte-nos sobre sua experiência, público e por que quer ser afiliado..."
                />
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3">
                <input type="checkbox" required className="mt-1 w-4 h-4 rounded" />
                <label className="text-sm text-slate-600">
                  Concordo com os{' '}
                  <a href="/affiliate-terms" className="text-violet-600 hover:underline">
                    termos do programa de afiliados
                  </a>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-indigo-700 transition"
              >
                Solicitar Inscrição
              </button>
            </div>
          </form>
        )}
      </section>

      {/* FAQ */}
      <section className="px-4 py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">Perguntas Frequentes</h2>

          <div className="space-y-6">
            {[
              {
                q: 'Quanto tempo leva para receber meu primeiro pagamento?',
                a: 'Se seu cliente se inscrever no dia 10, você receberá a primeira comissão no 15º dia útil de maio (aproximadamente 5 dias após a conversão).',
              },
              {
                q: 'Posso ganhar mais de R$ 100/mês?',
                a: 'Sim! Sem limite. Se você indicar 50 clientes/mês em média, seus ganhos serão de ~R$ 3.970/mês (recorrentes).',
              },
              {
                q: 'O cliente paga mais caro por ser afiliado?',
                a: 'Não. O preço é o mesmo. Você apenas recebe uma comissão sobre a venda.',
              },
              {
                q: 'A comissão é vitalícia?',
                a: 'Sim, enquanto o cliente permanecer ativo. Se o cliente cancela, sua comissão para automaticamente.',
              },
              {
                q: 'Como faço para sacar?',
                a: 'Quando seu saldo atingir R$ 100, você pode clicar em "Sacar" no dashboard. O pagamento é processado via PIX ou transferência no 15º dia útil..',
              },
              {
                q: 'E se meu link não funcionar?',
                a: 'Abra um ticket em suporte@prospector.ai ou envie mensagem no Slack do programa. Resolvemos em até 24h.',
              },
            ].map((faq, idx) => (
              <div key={idx} className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-900 mb-3">{faq.q}</h3>
                <p className="text-slate-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-4 py-16 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Pronto para Começar?</h2>
          <p className="text-violet-100 mb-8">
            Não é necessário pagar nada para entrar. Inscreva-se, comece a compartilhar e ganhe.
          </p>
          <a
            href="#registration"
            className="inline-block px-8 py-3 bg-white text-violet-600 font-semibold rounded-lg hover:bg-violet-50 transition"
          >
            Inscrever-se Agora
          </a>
        </div>
      </section>
    </div>
  );
}
