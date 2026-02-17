import { PrismaClient, UserRole, PlanType, SiteStatus } from '@prisma/client';
import { hashPassword } from '../../../shared/utils/password.js';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Starting database seed...');

  // Clean existing data (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.log('Cleaning existing data...');
    await prisma.alert.deleteMany();
    await prisma.checkResult.deleteMany();
    await prisma.check.deleteMany();
    await prisma.notificationChannel.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.site.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.team.deleteMany();
    await prisma.organization.deleteMany();
  }

  // Create demo organization
  console.log('Creating demo organization...');
  const demoOrg = await prisma.organization.create({
    data: {
      name: 'Demo Organization',
      slug: 'demo-org',
      plan: PlanType.CLOUD,
      limits: {
        sites: 3,
        checksPerSite: 100,
        agents: 3,
        notificationChannels: 9999,
        dataRetention: 90,
      },
    },
  });

  // Create demo team
  console.log('Creating demo team...');
  const demoTeam = await prisma.team.create({
    data: {
      name: 'Engineering Team',
      organizationId: demoOrg.id,
    },
  });

  // Create demo admin user
  console.log('Creating demo admin user...');
  const adminPassword = await hashPassword('Admin123!');
  await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: UserRole.ORG_ADMIN,
      organizationId: demoOrg.id,
      teamId: demoTeam.id,
    },
  });

  // Create demo member user
  console.log('Creating demo member user...');
  const memberPassword = await hashPassword('Member123!');
  await prisma.user.create({
    data: {
      email: 'member@demo.com',
      passwordHash: memberPassword,
      name: 'Member User',
      role: UserRole.ORG_MEMBER,
      organizationId: demoOrg.id,
      teamId: demoTeam.id,
    },
  });

  // Create demo sites
  console.log('Creating demo sites...');
  await prisma.site.create({
    data: {
      name: 'Production Website',
      url: 'https://example.com',
      organizationId: demoOrg.id,
      teamId: demoTeam.id,
      status: SiteStatus.ACTIVE,
      healthScore: 95.5,
      metadata: {
        description: 'Main production website',
        tags: ['production', 'web'],
      },
    },
  });

  await prisma.site.create({
    data: {
      name: 'API Server',
      url: 'https://api.example.com',
      organizationId: demoOrg.id,
      teamId: demoTeam.id,
      status: SiteStatus.ACTIVE,
      healthScore: 98.2,
      metadata: {
        description: 'Backend API server',
        tags: ['production', 'api'],
      },
    },
  });

  console.log('Seed completed successfully!');
  console.log('\nDemo credentials:');
  console.log('Admin: admin@demo.com / Admin123!');
  console.log('Member: member@demo.com / Member123!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
