// Order-builder CRM — bina order + hantar pay link. Dilindungi middleware /admin.
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { OrderClient } from "./order-client";

export default function CrmOrderPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Memuat…</div>}>
      <OrderClient />
    </Suspense>
  );
}
