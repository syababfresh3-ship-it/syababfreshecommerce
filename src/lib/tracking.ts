// Client-side pixel tracking — Meta Pixel + Google Ads
// Config injected by PixelScripts component via window globals

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void
    _fbq: unknown
    gtag: (...args: unknown[]) => void
    dataLayer: unknown[]
    __SF_GA_ID: string
    __SF_GA_LABEL: string
  }
}

export function trackAddToCart(productName: string, price: number, quantity: number) {
  if (typeof window === 'undefined') return
  const value = price * quantity
  window.fbq?.('track', 'AddToCart', { value, currency: 'MYR', content_name: productName, content_type: 'product' })
  window.gtag?.('event', 'add_to_cart', { currency: 'MYR', value, items: [{ item_name: productName, price, quantity }] })
}

export function trackInitiateCheckout(value: number) {
  if (typeof window === 'undefined') return
  window.fbq?.('track', 'InitiateCheckout', { value, currency: 'MYR' })
  window.gtag?.('event', 'begin_checkout', { currency: 'MYR', value })
}

export function trackPurchase(orderId: string, value: number, items: { product_name: string; unit_price: number; quantity: number }[]) {
  if (typeof window === 'undefined') return

  const contents = items.map(i => ({ id: i.product_name, quantity: i.quantity }))
  window.fbq?.('track', 'Purchase', { value, currency: 'MYR', content_type: 'product', contents })

  window.gtag?.('event', 'purchase', {
    transaction_id: orderId,
    value,
    currency: 'MYR',
    items: items.map(i => ({ item_name: i.product_name, price: i.unit_price, quantity: i.quantity })),
  })

  // Google Ads conversion — requires conversion label stored at init time
  if (window.__SF_GA_ID && window.__SF_GA_LABEL) {
    window.gtag?.('event', 'conversion', {
      send_to: `${window.__SF_GA_ID}/${window.__SF_GA_LABEL}`,
      value,
      currency: 'MYR',
      transaction_id: orderId,
    })
  }
}
