import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  getModulesForPlan,
  MODULES,
  type ModuleKey,
  type ProductPlan,
} from '@/lib/product-modules';

/**
 * GET /api/product/modules
 * Retorna os módulos disponíveis para o plano do workspace do usuário
 * e o catálogo completo (para exibir "bloqueado" no front).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      plan: true,
      workspaces: {
        take: 1,
        select: { workspace: { select: { plan: true } } },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const plan: ProductPlan =
    (user.workspaces[0]?.workspace?.plan as ProductPlan) ?? (user.plan as ProductPlan) ?? 'FREE';
  const moduleKeys = getModulesForPlan(plan);

  const catalog = (Object.keys(MODULES) as ModuleKey[]).map((key) => ({
    ...MODULES[key],
    enabled: moduleKeys.includes(key),
  }));

  return NextResponse.json({
    plan,
    modules: moduleKeys,
    catalog,
    tagline: 'Descubra onde vender, para quem vender e como abordar.',
  });
}
