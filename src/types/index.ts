// ============================================
// SYABABFRESH — Database Types
// ============================================

export interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  avatar_url: string | null
  tier_id: string | null
  total_points: number
  total_spend: number
  is_admin: boolean
  whatsapp_optin: boolean
  created_at: string
  updated_at: string
  // Joined
  loyalty_tier?: LoyaltyTier
}

export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  image_url: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  parent_id: string | null
}

export interface Product {
  id: string
  category_id: string | null
  name: string
  slug: string
  description: string | null
  price: number
  compare_price: number | null
  unit: string
  weight_grams?: number | null
  image_url: string | null
  images: string[] | null
  is_active: boolean
  is_featured: boolean
  show_in_storefront: boolean
  is_shippable: boolean
  is_cold: boolean
  sort_order: number
  created_at: string
  updated_at: string
  // Joined
  category?: Category
  available_stock?: number
}

export interface InventoryBatch {
  id: string
  product_id: string
  quantity: number
  batch_date: string
  expiry_date: string
  supplier: string | null
  cost_price: number | null
  notes: string | null
  created_at: string
  // Joined
  product?: Product
}

export interface Address {
  id: string
  user_id: string
  label: string
  recipient_name: string | null
  recipient_phone: string | null
  full_address: string
  city: string | null
  postcode: string | null
  state: string | null
  is_default: boolean
  created_at: string
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export type PaymentMethod = 'fpx' | 'ewallet' | 'cod' | 'bank_transfer'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'

export interface Order {
  id: string
  order_number: string
  user_id: string
  status: OrderStatus
  subtotal: number
  delivery_fee: number
  discount: number
  points_used: number
  points_discount: number
  total: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  payment_ref: string | null
  address_id: string | null
  delivery_address: string | null
  delivery_slot: string | null
  notes: string | null
  admin_notes: string | null
  promo_code_id: string | null
  confirmed_at: string | null
  preparing_at: string | null
  delivering_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
  // Joined
  items?: OrderItem[]
  profile?: Profile
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  price: number
  compare_price: number | null
  weight_grams: number | null
  stock: number
  sku: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  product_image: string | null
  quantity: number
  unit_price: number
  subtotal: number
  variant_id: string | null
  variant_name: string | null
  weight_grams: number | null
  created_at: string
}

export interface CartItem {
  id: string
  user_id: string
  product_id: string
  quantity: number
  created_at: string
  updated_at: string
  // Joined
  product?: Product
}

export interface LoyaltyTier {
  id: string
  name: string
  min_spend: number
  multiplier: number
  perks: string | null
  sort_order: number
  created_at: string
}

export interface LoyaltyTransaction {
  id: string
  user_id: string
  order_id: string | null
  points: number
  type: 'earn' | 'redeem' | 'bonus' | 'adjustment'
  description: string | null
  created_at: string
}

// Cart store type (client-side with Zustand)
export interface CartStore {
  items: CartItemLocal[]
  addItem: (product: Product, quantity?: number, variant?: ProductVariant | null) => void
  removeItem: (productId: string, variantId?: string | null) => void
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void
  clearCart: () => void
  getTotal: () => number
  getItemCount: () => number
}

export interface CartItemLocal {
  product: Product
  variant: ProductVariant | null
  quantity: number
}

export type ShipmentStatus =
  | 'pending'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'

export interface ShippingCarrier {
  id: string
  name: string
  is_active: boolean
  config: Record<string, string>
  tracking_url_template: string | null
  sort_order: number
  created_at: string
}

export interface OrderShipment {
  id: string
  order_id: string
  carrier_id: string
  tracking_number: string | null
  tracking_url: string | null
  status: ShipmentStatus
  notes: string | null
  shipped_at: string | null
  estimated_delivery: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
  // Joined
  shipping_carriers?: ShippingCarrier
}
