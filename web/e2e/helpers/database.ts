import { createPrisma } from '../../../backend/src/db'
import { testDatabaseUrl } from '../env'

export async function resetE2eDatabase() {
  const prisma = createPrisma(testDatabaseUrl)

  try {
    await prisma.authSession.deleteMany()
    await prisma.order.deleteMany()
    await prisma.bicycle.deleteMany()
    await prisma.manufacturerProfile.deleteMany()
    await prisma.user.deleteMany()
  } finally {
    await prisma.$disconnect()
  }
}

export async function readRentalOrderSnapshot(orderId: string) {
  const prisma = createPrisma(testDatabaseUrl)

  try {
    return await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        checklists: { orderBy: { createdAt: 'asc' } },
        items: {
          include: {
            bicycle: true,
          },
        },
        payments: { orderBy: { createdAt: 'asc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    })
  } finally {
    await prisma.$disconnect()
  }
}
