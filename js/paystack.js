// Paystack Inline (Popup) checkout integration.
// Public key (safe to expose client-side). Override at deploy time via
// window.ADVAULT_PAYSTACK_PUBLIC_KEY in index.html — no code change needed.
// This is the PUBLIC (test) key — safe to ship in frontend code.
// It only authorizes starting a charge; the backend verifies it server-side
// with the SECRET key before crediting anything.
export const PAYSTACK_PUBLIC_KEY = window.ADVAULT_PAYSTACK_PUBLIC_KEY || 'pk_test_e69222b91a5e669835adbc914758c9dfc11004a9'

let scriptPromise = null
export function loadPaystack(){
  if(window.PaystackPop) return Promise.resolve()
  if(scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return scriptPromise
}

// Opens the Paystack popup. amountGHS is in whole cedis (converted to pesewas here).
export function payWithPaystack({ email, amountGHS, reference, onClose }){
  return new Promise((resolve, reject) => {
    try{
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email,
        amount: Math.round(amountGHS * 100),
        currency: 'GHS',
        ref: reference,
        callback: (response) => resolve(response),
        onClose: () => {
          if(onClose) onClose()
          reject(new Error('closed'))
        },
      })
      handler.openIframe()
    }catch(err){
      reject(err)
    }
  })
}

export function newReference(prefix = 'advault'){
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}
