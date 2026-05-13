import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'

import { PageHeading } from '@/components/page-heading'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export function HomeSessionCard({ email }: { email: string }) {
  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <PageHeading
          eyebrow="Активная сессия"
          eyebrowTone="secondary"
          title="Сессия активна"
          description={
            <>
              Вы вошли как <strong>{email}</strong>. Базовая авторизация готова для рабочих
              сценариев.
            </>
          }
          size="page"
        />
      </CardHeader>
      <CardContent>
        <Button asChild>
          <Link to="/app">
            Открыть профиль
            <ArrowRightIcon data-icon="inline-end" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
