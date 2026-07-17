import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate, formatOrderLabel } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  new: "secondary",
  preparing: "warning",
  ready: "default",
  delivered: "success",
  completed: "success",
};

const PAYMENT_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  paid: "success",
  pending: "warning",
  failed: "destructive",
};

export default async function AdminOrdersPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, table:table_id(table_number)")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground">All orders placed at your restaurant.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                  <th className="p-4 font-medium">Order</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Table</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Payment</th>
                  <th className="p-4 font-medium">Delivered by</th>
                  <th className="p-4 font-medium">Method</th>
                  <th className="p-4 font-medium">Total</th>
                  <th className="p-4 font-medium">Placed</th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((order: any) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="p-4 font-semibold">{formatOrderLabel(order, { prefix: false })}</td>
                    <td className="p-4 capitalize">{order.order_type}</td>
                    <td className="p-4">{order.table?.table_number ?? "—"}</td>
                    <td className="p-4">
                      <Badge variant={STATUS_VARIANT[order.status]} className="capitalize">
                        {order.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={PAYMENT_VARIANT[order.payment_status]} className="capitalize">
                        {order.payment_status}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{order.delivered_by ?? "—"}</td>
                    <td className="p-4 uppercase text-muted-foreground">{order.payment_method ?? "—"}</td>
                    <td className="p-4 font-medium">{formatCurrency(Number(order.total))}</td>
                    <td className="p-4 text-muted-foreground">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
                {(!orders || orders.length === 0) && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
