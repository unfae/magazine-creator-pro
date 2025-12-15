import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export function TemplateAccessGuard({
  templatePay,
  children
}: {
  templatePay: any
  children: React.ReactNode
}) {
  const [unlocked, setUnlocked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        setUnlocked(false)
        setLoading(false)
        return
      }

      // Free template
      if (!templatePay?.price || templatePay.price === 0) {
        setUnlocked(true)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('template_payments')
        .select('id')
        .eq('user_id', user.id)
        .eq('template_id', templatePay.id)
        .eq('status', 'success')
        .maybeSingle()

      if (error) {
        console.error(error)
      }

      setUnlocked(!!data)
      setLoading(false)
    }

    checkAccess()
  }, [templatePay?.id, templatePay?.price])

  const handlePay = async () => {
    const { data, error } = await supabase.functions.invoke('init-paystack', {
      body: {
        templateId: templatePay.id,
        amount: templatePay.price
      }
    })

    if (error) {
      console.error(error)
      return
    }

    window.location.href = data.data.authorization_url
  }

  if (loading) return null

  if (!unlocked) {
    return (
      <div className="border rounded-lg p-6 text-center space-y-4">
        <p className="font-medium">
          This template costs ₦{templatePay.price.toLocaleString()}
        </p>
        <Button onClick={handlePay}>
          Unlock Template
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
