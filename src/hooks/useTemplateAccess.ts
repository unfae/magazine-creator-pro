import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export function useTemplateAccess(templatePay: any) {
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        setHasAccess(false)
        setLoading(false)
        return
      }

      // Free template
      if (!templatePay.price || templatePay.price === 0) {
        setHasAccess(true)
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

      setHasAccess(!!data)
      setLoading(false)
    }

    checkAccess()
  }, [template])

  const openPaywall = async () => {
    const { data, error } = await supabase.functions.invoke(
      'init-paystack',
      {
        body: {
          templateId: template.id,
          amount: template.price
        }
      }
    )

    if (error) {
      console.error(error)
      return
    }

    window.location.href = data.data.authorization_url
  }

  return {
    hasTemplateAccess: hasAccess,
    loading,
    openPaywall
  }
}
