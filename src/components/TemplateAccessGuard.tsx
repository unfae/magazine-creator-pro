import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export function TemplateAccessGuard({
  template,
  children
}: {
  template: any
  children: React.ReactNode
}) {
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (!template.price || template.price === 0) {
        setUnlocked(true)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('template_payments')
        .select('id')
        .eq('user_id', user.id)
        .eq('template_id', template.id)
        .eq('status', 'success')
        .maybeSingle()

      setUnlocked(!!data)
      setLoading(false)
    }

    checkAccess()
  }, [template])

  const handlePay = async () => {
    const { data } = await supabase.functions.invoke('init-paystack', {
      body: {
        templateId: template.id,
        amount: template.price
      }
    })

    window.location.href = data.data.authorization_url
  }

  if (loading) return null

  if (!unlocked) {
    return (
      <div className="border rounded-lg p-6 text-center space-y-4">
        <p className="font-medium">
          This template costs ₦{template.price.toLocaleString()}
        </p>
        <Button onClick={handlePay}>
          Unlock Template
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
