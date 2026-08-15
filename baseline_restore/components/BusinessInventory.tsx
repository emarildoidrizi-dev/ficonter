"use client";

import {
  AlertTriangle,
  Archive,
  ArrowDownCircle,
  ArrowUpCircle,
  Barcode,
  Boxes,
  CheckCircle2,
  Edit3,
  History,
  MapPin,
  PackageCheck,
  PackageOpen,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getExchangeRate } from "@/lib/performance/exchangeRateCache";
import { finiteNumber, roundMoney, roundRate, sumMoney } from "@/lib/finance/money";
import {
  CURRENCY_CODES,
  currencyName,
  currencySymbol,
  formatCurrency,
} from "@/lib/financialOptions";
import type {
  Business,
  BusinessCostCategory,
  BusinessCostCentre,
  BusinessInventoryCategory,
  BusinessInventoryItemSnapshot,
  BusinessInventoryLocation,
  BusinessInventoryMovement,
  BusinessInventoryMovementType,
  BusinessSupplier,
  BusinessTransaction,
} from "@/lib/business/types";
import styles from "./BusinessInventory.module.css";

const UNITS = ["unit", "piece", "box", "pack", "pair", "set", "kg", "g", "litre", "metre", "m²", "roll"];
const PAYMENT_METHODS = ["Bank transfer", "Card", "Cash", "Direct debit", "Online payment", "Invoice", "Other"];

const MOVEMENT_OPTIONS: Array<{
  value: Exclude<BusinessInventoryMovementType, "opening_stock" | "reversal">;
  label: string;
  direction: "in" | "out";
  help: string;
}> = [
  { value: "purchase", label: "Purchase / receive stock", direction: "in", help: "Adds stock and can create a Cost Control expense." },
  { value: "adjustment_in", label: "Adjustment increase", direction: "in", help: "Corrects stock upward without recording a cash expense." },
  { value: "return_in", label: "Customer return", direction: "in", help: "Returns previously issued stock to inventory." },
  { value: "sale", label: "Sale / stock issued", direction: "out", help: "Reduces stock only. Revenue integration is added in B6." },
  { value: "used", label: "Used in operations", direction: "out", help: "Records materials or supplies consumed by the business." },
  { value: "damaged", label: "Damaged stock", direction: "out", help: "Removes unusable stock while preserving the audit history." },
  { value: "lost", label: "Lost stock", direction: "out", help: "Records missing stock." },
  { value: "adjustment_out", label: "Adjustment decrease", direction: "out", help: "Corrects stock downward." },
  { value: "return_out", label: "Return to supplier", direction: "out", help: "Removes stock returned to a supplier." },
];

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localTimeKey(date = new Date()) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function movementTimestamp(dateValue: string, timeValue: string) {
  const value = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(value.getTime())) throw new Error("Enter a valid movement date and time.");
  return value.toISOString();
}

function roundInventory(value: unknown) {
  return Math.round((finiteNumber(value) + Number.EPSILON) * 10000) / 10000;
}

function mergeRealtime<T extends { id: string }>(
  current: T[],
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
) {
  if (payload.eventType === "DELETE") {
    const id = (payload.old as { id?: string }).id;
    return current.filter((item) => item.id !== id);
  }
  const changed = payload.new as unknown as T;
  return [changed, ...current.filter((item) => item.id !== changed.id)];
}

const EMPTY_ITEM = {
  name: "",
  sku: "",
  barcode: "",
  category_id: "",
  supplier_id: "",
  location_id: "",
  unit: "unit",
  low_stock_threshold: "0",
  default_purchase_cost: "",
  default_purchase_currency: "EUR",
  selling_price_base: "",
  opening_quantity: "0",
  notes: "",
};

const EMPTY_MOVEMENT = {
  movement_type: "purchase" as Exclude<BusinessInventoryMovementType, "opening_stock" | "reversal">,
  quantity: "",
  unit_cost: "",
  currency: "EUR",
  supplier_id: "",
  movement_date: localDateKey(),
  movement_time: localTimeKey(),
  reference: "",
  notes: "",
  create_expense: true,
  payment_method: "Bank transfer",
  cost_category_id: "",
  cost_centre_id: "",
};

export function BusinessInventory({
  business,
  initialItems,
  initialMovements,
  initialCategories,
  initialLocations,
  initialSuppliers,
  initialCostCategories,
  initialCostCentres,
}: {
  business: Business;
  initialItems: BusinessInventoryItemSnapshot[];
  initialMovements: BusinessInventoryMovement[];
  initialCategories: BusinessInventoryCategory[];
  initialLocations: BusinessInventoryLocation[];
  initialSuppliers: BusinessSupplier[];
  initialCostCategories: BusinessCostCategory[];
  initialCostCentres: BusinessCostCentre[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState(initialItems);
  const [movements, setMovements] = useState(initialMovements);
  const [categories, setCategories] = useState(initialCategories);
  const [locations, setLocations] = useState(initialLocations);
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<BusinessInventoryItemSnapshot | null>(null);
  const [itemForm, setItemForm] = useState(() => ({
    ...EMPTY_ITEM,
    category_id: initialCategories.find((item) => item.is_active)?.id ?? "",
    location_id: initialLocations.find((item) => item.is_active)?.id ?? "",
    default_purchase_currency: business.base_currency,
  }));
  const [movementItem, setMovementItem] = useState<BusinessInventoryItemSnapshot | null>(null);
  const inventoryCostCategory = initialCostCategories.find((item) => item.name.toLowerCase() === "inventory purchases")
    ?? initialCostCategories.find((item) => item.is_active)
    ?? initialCostCategories[0];
  const [movementForm, setMovementForm] = useState(() => ({
    ...EMPTY_MOVEMENT,
    currency: business.base_currency,
    cost_category_id: inventoryCostCategory?.id ?? "",
  }));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [historyItemId, setHistoryItemId] = useState("all");
  const [categoryName, setCategoryName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function refreshInventory() {
    const [{ data: itemData }, { data: movementData }] = await Promise.all([
      supabase
        .from("business_inventory_item_balances")
        .select("*")
        .eq("business_id", business.id)
        .order("name", { ascending: true }),
      supabase
        .from("business_inventory_movements")
        .select("id,business_id,item_id,item_name,item_sku,created_by,movement_type,quantity_delta,unit_cost,currency,unit_cost_base,inventory_value_delta_base,exchange_rate_to_base,exchange_rate_date,exchange_rate_source,supplier_id,supplier_name,transaction_id,reversal_of_id,movement_date,occurred_at,reference,notes,created_at")
        .eq("business_id", business.id)
        .order("occurred_at", { ascending: false })
        .limit(2500),
    ]);
    if (itemData) setItems(itemData as BusinessInventoryItemSnapshot[]);
    if (movementData) setMovements(movementData as BusinessInventoryMovement[]);
  }

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const channel = supabase
      .channel(`business-inventory-${business.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_inventory_items", filter: `business_id=eq.${business.id}` },
        () => { void refreshInventory(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_inventory_movements", filter: `business_id=eq.${business.id}` },
        () => { void refreshInventory(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_inventory_categories", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setCategories((current) => mergeRealtime<BusinessInventoryCategory>(current, payload).sort((a, b) => a.name.localeCompare(b.name)));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_inventory_locations", filter: `business_id=eq.${business.id}` },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          setLocations((current) => mergeRealtime<BusinessInventoryLocation>(current, payload).sort((a, b) => a.name.localeCompare(b.name)));
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [business.id, supabase]);

  const activeItems = items.filter((item) => item.status === "active");
  const inventoryValue = sumMoney(activeItems.map((item) => item.inventory_value_base));
  const retailValue = sumMoney(activeItems.map((item) => item.potential_sales_value_base));
  const potentialGrossProfit = sumMoney(activeItems.map((item) => item.potential_gross_profit_base));
  const lowStockItems = activeItems.filter(
    (item) => finiteNumber(item.quantity_on_hand) <= finiteNumber(item.low_stock_threshold),
  );
  const money = (value: unknown) => formatCurrency(finiteNumber(value), business.base_currency);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const searchable = [item.name, item.sku, item.barcode, item.category_name, item.supplier_name, item.location_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!query || searchable.includes(query))
        && (statusFilter === "all" || item.status === statusFilter)
        && (categoryFilter === "all" || item.category_id === categoryFilter)
        && (locationFilter === "all" || item.location_id === locationFilter)
      );
    });
  }, [items, search, statusFilter, categoryFilter, locationFilter]);

  const visibleMovements = useMemo(
    () => movements.filter((movement) => historyItemId === "all" || movement.item_id === historyItemId).slice(0, 250),
    [movements, historyItemId],
  );

  function resetItemForm() {
    setItemForm({
      ...EMPTY_ITEM,
      category_id: categories.find((item) => item.is_active)?.id ?? "",
      location_id: locations.find((item) => item.is_active)?.id ?? "",
      default_purchase_currency: business.base_currency,
    });
    setEditingItem(null);
    setShowItemForm(false);
    setError("");
  }

  function editItem(item: BusinessInventoryItemSnapshot) {
    setItemForm({
      name: item.name,
      sku: item.sku,
      barcode: item.barcode ?? "",
      category_id: item.category_id ?? "",
      supplier_id: item.supplier_id ?? "",
      location_id: item.location_id ?? "",
      unit: item.unit,
      low_stock_threshold: String(item.low_stock_threshold),
      default_purchase_cost: String(item.default_purchase_cost),
      default_purchase_currency: item.default_purchase_currency,
      selling_price_base: String(item.selling_price_base),
      opening_quantity: "0",
      notes: item.notes ?? "",
    });
    setEditingItem(item);
    setShowItemForm(true);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("item");
    setError("");

    try {
      const name = itemForm.name.trim();
      const sku = itemForm.sku.trim().toUpperCase();
      const defaultPurchaseCost = roundInventory(itemForm.default_purchase_cost || 0);
      const openingQuantity = roundInventory(itemForm.opening_quantity || 0);
      const threshold = roundInventory(itemForm.low_stock_threshold || 0);
      const sellingPrice = roundMoney(itemForm.selling_price_base || 0);
      if (!name || !sku) throw new Error("Enter the item name and SKU.");
      if (defaultPurchaseCost < 0 || openingQuantity < 0 || threshold < 0 || sellingPrice < 0) {
        throw new Error("Inventory quantities and prices cannot be negative.");
      }

      const rate = await getExchangeRate(itemForm.default_purchase_currency, business.base_currency);
      const defaultPurchaseCostBase = roundInventory(defaultPurchaseCost * rate.rate);

      if (editingItem) {
        const { error: updateError } = await supabase
          .from("business_inventory_items")
          .update({
            name,
            sku,
            barcode: itemForm.barcode.trim() || null,
            category_id: itemForm.category_id || null,
            supplier_id: itemForm.supplier_id || null,
            location_id: itemForm.location_id || null,
            unit: itemForm.unit,
            low_stock_threshold: threshold,
            default_purchase_cost: defaultPurchaseCost,
            default_purchase_currency: itemForm.default_purchase_currency,
            default_purchase_cost_base: defaultPurchaseCostBase,
            default_exchange_rate_to_base: roundRate(rate.rate),
            selling_price_base: sellingPrice,
            notes: itemForm.notes.trim() || null,
          })
          .eq("id", editingItem.id)
          .eq("business_id", business.id);
        if (updateError) throw updateError;
        setNotice("Inventory item updated.");
      } else {
        const { error: rpcError } = await supabase.rpc("create_business_inventory_item", {
          p_business_id: business.id,
          p_name: name,
          p_sku: sku,
          p_barcode: itemForm.barcode.trim() || undefined,
          p_category_id: itemForm.category_id || undefined,
          p_supplier_id: itemForm.supplier_id || undefined,
          p_location_id: itemForm.location_id || undefined,
          p_unit: itemForm.unit,
          p_low_stock_threshold: threshold,
          p_default_purchase_cost: defaultPurchaseCost,
          p_default_purchase_currency: itemForm.default_purchase_currency,
          p_default_purchase_cost_base: defaultPurchaseCostBase,
          p_default_exchange_rate_to_base: roundRate(rate.rate),
          p_selling_price_base: sellingPrice,
          p_opening_quantity: openingQuantity,
          p_notes: itemForm.notes.trim() || undefined,
        });
        if (rpcError) throw rpcError;
        setNotice(openingQuantity > 0 ? "Inventory item and opening stock added." : "Inventory item added.");
      }

      await refreshInventory();
      resetItemForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Inventory item could not be saved.");
    } finally {
      setBusy("");
    }
  }

  function openMovement(item: BusinessInventoryItemSnapshot) {
    const supplier = suppliers.find((entry) => entry.id === item.supplier_id);
    setMovementItem(item);
    setMovementForm({
      ...EMPTY_MOVEMENT,
      unit_cost: String(item.default_purchase_cost || ""),
      currency: supplier?.default_currency || item.default_purchase_currency || business.base_currency,
      supplier_id: item.supplier_id ?? "",
      cost_category_id: inventoryCostCategory?.id ?? "",
      movement_date: localDateKey(),
      movement_time: localTimeKey(),
    });
    setError("");
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movementItem || busy) return;
    setBusy("movement");
    setError("");

    try {
      const option = MOVEMENT_OPTIONS.find((entry) => entry.value === movementForm.movement_type);
      if (!option) throw new Error("Choose a valid movement type.");
      const quantity = roundInventory(movementForm.quantity);
      if (quantity <= 0) throw new Error("Enter a quantity greater than zero.");

      const needsCost = option.direction === "in";
      const unitCost = needsCost ? roundInventory(movementForm.unit_cost || 0) : 0;
      if (needsCost && unitCost < 0) throw new Error("The unit cost cannot be negative.");
      if (movementForm.movement_type === "purchase" && unitCost <= 0) {
        throw new Error("A stock purchase requires a unit cost greater than zero.");
      }

      const rate = needsCost
        ? await getExchangeRate(movementForm.currency, business.base_currency)
        : { rate: 1, date: movementForm.movement_date, source: "Weighted average inventory cost" };
      const unitCostBase = needsCost ? roundInventory(unitCost * rate.rate) : 0;
      const occurredAt = movementTimestamp(movementForm.movement_date, movementForm.movement_time);

      const { data, error: rpcError } = await supabase.rpc("record_business_inventory_movement", {
        p_item_id: movementItem.id,
        p_movement_type: movementForm.movement_type,
        p_quantity: quantity,
        p_unit_cost: unitCost,
        p_currency: movementForm.currency,
        p_unit_cost_base: unitCostBase,
        p_exchange_rate_to_base: roundRate(rate.rate),
        p_exchange_rate_date: rate.date,
        p_exchange_rate_source: rate.source,
        p_supplier_id: movementForm.supplier_id || undefined,
        p_movement_date: movementForm.movement_date,
        p_occurred_at: occurredAt,
        p_reference: movementForm.reference.trim() || undefined,
        p_notes: movementForm.notes.trim() || undefined,
        p_create_expense: movementForm.movement_type === "purchase" && movementForm.create_expense,
        p_payment_method: movementForm.payment_method || undefined,
        p_cost_category_id: movementForm.cost_category_id || undefined,
        p_cost_centre_id: movementForm.cost_centre_id || undefined,
      });
      if (rpcError) throw rpcError;

      const result = data as { transaction?: BusinessTransaction | null } | null;
      await refreshInventory();
      setMovementItem(null);
      setNotice(
        result?.transaction
          ? "Stock received and purchase added to Business Transactions and Cost Control."
          : "Inventory movement recorded.",
      );
    } catch (movementError) {
      setError(movementError instanceof Error ? movementError.message : "Inventory movement could not be recorded.");
    } finally {
      setBusy("");
    }
  }

  async function reverseMovement(movement: BusinessInventoryMovement) {
    if (busy) return;
    setBusy(`reverse-${movement.id}`);
    setError("");
    try {
      const { error: rpcError } = await supabase.rpc("reverse_business_inventory_movement", {
        p_movement_id: movement.id,
        p_occurred_at: new Date().toISOString(),
        p_notes: "Reversed from Inventory movement history",
      });
      if (rpcError) throw rpcError;
      await refreshInventory();
      setNotice("Movement reversed. Any linked purchase transaction was removed.");
    } catch (reverseError) {
      setError(reverseError instanceof Error ? reverseError.message : "Movement could not be reversed.");
    } finally {
      setBusy("");
    }
  }

  async function toggleItemStatus(item: BusinessInventoryItemSnapshot) {
    if (busy) return;
    setBusy(`status-${item.id}`);
    const next = item.status === "active" ? "discontinued" : "active";
    const { error: updateError } = await supabase
      .from("business_inventory_items")
      .update({ status: next })
      .eq("id", item.id)
      .eq("business_id", business.id);
    if (updateError) setError(updateError.message);
    else {
      await refreshInventory();
      setNotice(next === "active" ? "Inventory item reactivated." : "Inventory item archived.");
    }
    setBusy("");
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name || busy) return;
    setBusy("category");
    const { data, error: insertError } = await supabase
      .from("business_inventory_categories")
      .insert({ business_id: business.id, name })
      .select()
      .single();
    if (insertError) setError(insertError.message);
    else {
      setCategories((current) => [...current, data as BusinessInventoryCategory].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryName("");
      setNotice("Inventory category added.");
    }
    setBusy("");
  }

  async function addLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = locationName.trim();
    if (!name || busy) return;
    setBusy("location");
    const { data, error: insertError } = await supabase
      .from("business_inventory_locations")
      .insert({ business_id: business.id, name })
      .select()
      .single();
    if (insertError) setError(insertError.message);
    else {
      setLocations((current) => [...current, data as BusinessInventoryLocation].sort((a, b) => a.name.localeCompare(b.name)));
      setLocationName("");
      setNotice("Inventory location added.");
    }
    setBusy("");
  }

  function movementLabel(type: BusinessInventoryMovementType) {
    if (type === "opening_stock") return "Opening stock";
    if (type === "reversal") return "Reversal";
    return MOVEMENT_OPTIONS.find((option) => option.value === type)?.label ?? type.replaceAll("_", " ");
  }

  return (
    <section className={styles.shell}>
      <header className={styles.hero}>
        <div>
          <span>FICONTER BUSINESS</span>
          <h1>Inventory</h1>
          <p>
            Control stock quantities, weighted inventory value, suppliers,
            storage locations and every movement for {business.name}.
          </p>
        </div>
        <button onClick={() => (showItemForm ? resetItemForm() : setShowItemForm(true))}>
          {showItemForm ? <X size={18} /> : <Plus size={18} />}
          {showItemForm ? "Close form" : "Add inventory item"}
        </button>
      </header>

      {notice ? <div className={styles.notice}>{notice}</div> : null}
      {error && !showItemForm && !movementItem ? <div className={styles.error}>{error}</div> : null}

      {showItemForm ? (
        <form className={styles.formCard} onSubmit={saveItem}>
          <div className={styles.formHead}>
            <div><span>{editingItem ? "EDIT ITEM" : "NEW INVENTORY ITEM"}</span><h2>{editingItem ? "Update item details" : "Create a stock item"}</h2></div>
            {editingItem ? <button type="button" onClick={resetItemForm}>Cancel edit</button> : null}
          </div>
          <div className={styles.formGrid}>
            <label>Item name<input value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} required /></label>
            <label>SKU<input value={itemForm.sku} onChange={(event) => setItemForm({ ...itemForm, sku: event.target.value.toUpperCase() })} placeholder="Unique stock code" required /></label>
            <label>Barcode<input value={itemForm.barcode} onChange={(event) => setItemForm({ ...itemForm, barcode: event.target.value })} placeholder="Optional" /></label>
            <label>Inventory category<select value={itemForm.category_id} onChange={(event) => setItemForm({ ...itemForm, category_id: event.target.value })}><option value="">No category</option>{categories.filter((category) => category.is_active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
            <label>Primary supplier<select value={itemForm.supplier_id} onChange={(event) => { const supplier = suppliers.find((entry) => entry.id === event.target.value); setItemForm({ ...itemForm, supplier_id: event.target.value, default_purchase_currency: supplier?.default_currency ?? itemForm.default_purchase_currency }); }}><option value="">No supplier</option>{suppliers.filter((supplier) => supplier.status === "active").map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
            <label>Storage location<select value={itemForm.location_id} onChange={(event) => setItemForm({ ...itemForm, location_id: event.target.value })}><option value="">No location</option>{locations.filter((location) => location.is_active).map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select></label>
            <label>Unit<select value={itemForm.unit} onChange={(event) => setItemForm({ ...itemForm, unit: event.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label>Low-stock level<input type="number" min="0" step="0.0001" value={itemForm.low_stock_threshold} onChange={(event) => setItemForm({ ...itemForm, low_stock_threshold: event.target.value })} /></label>
            <label>Default purchase cost<input type="number" min="0" step="0.0001" value={itemForm.default_purchase_cost} onChange={(event) => setItemForm({ ...itemForm, default_purchase_cost: event.target.value })} /></label>
            <label>Purchase currency<select value={itemForm.default_purchase_currency} onChange={(event) => setItemForm({ ...itemForm, default_purchase_currency: event.target.value })}>{CURRENCY_CODES.map((code) => <option value={code} key={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label>
            <label>Selling price ({business.base_currency})<input type="number" min="0" step="0.01" value={itemForm.selling_price_base} onChange={(event) => setItemForm({ ...itemForm, selling_price_base: event.target.value })} /></label>
            {!editingItem ? <label>Opening quantity<input type="number" min="0" step="0.0001" value={itemForm.opening_quantity} onChange={(event) => setItemForm({ ...itemForm, opening_quantity: event.target.value })} /></label> : null}
            <label className={styles.fullWidth}>Notes<textarea rows={3} value={itemForm.notes} onChange={(event) => setItemForm({ ...itemForm, notes: event.target.value })} /></label>
          </div>
          {error ? <div className={styles.error}>{error}</div> : null}
          <button className={styles.primaryButton} disabled={busy === "item"}>{busy === "item" ? "Saving…" : editingItem ? "Save changes" : "Save item"}</button>
        </form>
      ) : null}

      <div className={styles.summaryGrid}>
        <article><Boxes /><span>Inventory value</span><strong>{money(inventoryValue)}</strong></article>
        <article><PackageCheck /><span>Active items</span><strong>{activeItems.length}</strong></article>
        <article className={lowStockItems.length ? styles.warningCard : ""}><AlertTriangle /><span>Low-stock alerts</span><strong>{lowStockItems.length}</strong></article>
        <article><ArrowUpCircle /><span>Potential gross profit</span><strong>{money(potentialGrossProfit)}</strong><small>{money(retailValue)} potential sales</small></article>
      </div>

      <article className={styles.masterPanel}>
        <div><span>INVENTORY SETUP</span><h2>Categories and locations</h2><p>Add reusable labels before creating stock items.</p></div>
        <form onSubmit={addCategory}><Tag size={17} /><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="New category" /><button disabled={busy === "category"}><Plus size={16} /> Add</button></form>
        <form onSubmit={addLocation}><MapPin size={17} /><input value={locationName} onChange={(event) => setLocationName(event.target.value)} placeholder="New location" /><button disabled={busy === "location"}><Plus size={16} /> Add</button></form>
      </article>

      <div className={styles.filters}>
        <label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, SKU, barcode, supplier or location" /></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="active">Active items</option><option value="discontinued">Archived items</option><option value="all">All statuses</option></select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>
        <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><option value="all">All locations</option>{locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}</select>
      </div>

      <div className={`${styles.itemGrid} ficonter-scroll-region`}>
        {visibleItems.length ? visibleItems.map((item) => {
          const quantity = finiteNumber(item.quantity_on_hand);
          const threshold = finiteNumber(item.low_stock_threshold);
          const low = item.status === "active" && quantity <= threshold;
          return (
            <article className={`${styles.itemCard} ${low ? styles.lowCard : ""}`} key={item.id}>
              <div className={styles.cardTop}>
                <div className={styles.itemIcon}><PackageOpen size={21} /></div>
                <div className={styles.identity}>
                  <div><h2>{item.name}</h2><span className={`${styles.status} ${item.status === "active" ? styles.active : styles.discontinued}`}>{item.status}</span>{low ? <span className={`${styles.status} ${styles.low}`}>low stock</span> : null}</div>
                  <p><Barcode size={13} /> {item.sku}{item.barcode ? ` · ${item.barcode}` : ""}</p>
                </div>
                <div className={styles.cardActions}>
                  <button onClick={() => editItem(item)} aria-label={`Edit ${item.name}`}><Edit3 size={16} /></button>
                  <button onClick={() => toggleItemStatus(item)} aria-label={item.status === "active" ? `Archive ${item.name}` : `Reactivate ${item.name}`}><Archive size={16} /></button>
                </div>
              </div>

              <div className={styles.stockHero}>
                <div><span>On hand</span><strong>{quantity.toLocaleString("en-GB", { maximumFractionDigits: 4 })}</strong><small>{item.unit}</small></div>
                <div><span>Inventory value</span><strong>{money(item.inventory_value_base)}</strong><small>{money(item.average_cost_base)} average cost</small></div>
              </div>

              <div className={styles.detailsGrid}>
                <span><Tag size={14} />{item.category_name || "No category"}</span>
                <span><Truck size={14} />{item.supplier_name || "No supplier"}</span>
                <span><MapPin size={14} />{item.location_name || "No location"}</span>
                <span><SlidersHorizontal size={14} />Low at {threshold.toLocaleString("en-GB", { maximumFractionDigits: 4 })}</span>
              </div>

              <div className={styles.valueRow}>
                <div><span>Selling price</span><strong>{money(item.selling_price_base)}</strong></div>
                <div><span>Potential sales</span><strong>{money(item.potential_sales_value_base)}</strong></div>
                <div><span>Movements</span><strong>{item.movement_count}</strong></div>
              </div>

              <button className={styles.movementButton} onClick={() => openMovement(item)} disabled={item.status !== "active"}><Plus size={17} /> Record stock movement</button>
            </article>
          );
        }) : <div className={styles.emptyState}><PackageOpen size={36} /><h2>No inventory items found</h2><p>Add an item or change the current filters.</p></div>}
      </div>

      <article className={styles.historyPanel}>
        <div className={styles.historyHead}>
          <div><History size={19} /><div><span>IMMUTABLE STOCK LEDGER</span><h2>Movement history</h2></div></div>
          <select value={historyItemId} onChange={(event) => setHistoryItemId(event.target.value)}><option value="all">All inventory items</option>{items.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.sku}</option>)}</select>
        </div>
        <div className={`${styles.historyRows} ficonter-scroll-region`}>
          {visibleMovements.length ? visibleMovements.map((movement) => {
            const reversed = movements.some((entry) => entry.reversal_of_id === movement.id);
            const incoming = finiteNumber(movement.quantity_delta) > 0;
            return (
              <div className={styles.historyRow} key={movement.id}>
                <div className={incoming ? styles.inIcon : styles.outIcon}>{incoming ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}</div>
                <div><strong>{movement.item_name}</strong><span>{movementLabel(movement.movement_type)} · {new Date(movement.occurred_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span></div>
                <div className={styles.historyQuantity}><strong>{incoming ? "+" : ""}{finiteNumber(movement.quantity_delta).toLocaleString("en-GB", { maximumFractionDigits: 4 })}</strong><span>{movement.item_sku}</span></div>
                <div className={styles.historyValue}><strong>{money(Math.abs(finiteNumber(movement.inventory_value_delta_base)))}</strong><span>{movement.supplier_name || movement.reference || "Inventory ledger"}</span></div>
                {movement.movement_type !== "reversal" && !reversed ? <button onClick={() => reverseMovement(movement)} disabled={busy === `reverse-${movement.id}`} title="Reverse movement"><RotateCcw size={16} /></button> : <span className={styles.reversed}>{reversed ? "reversed" : "audit entry"}</span>}
              </div>
            );
          }) : <p className={styles.emptyHistory}>No inventory movements yet.</p>}
        </div>
      </article>

      {movementItem ? (
        <div className={styles.backdrop}>
          <form className={styles.modal} onSubmit={saveMovement}>
            <button className={styles.modalClose} type="button" onClick={() => { setMovementItem(null); setError(""); }}><X size={18} /></button>
            <PackageOpen className={styles.modalIcon} />
            <span>RECORD STOCK MOVEMENT</span>
            <h2>{movementItem.name}</h2>
            <p>Available: {finiteNumber(movementItem.quantity_on_hand).toLocaleString("en-GB", { maximumFractionDigits: 4 })} {movementItem.unit} · Weighted cost {money(movementItem.average_cost_base)}</p>
            <div className={styles.modalGrid}>
              <label>Movement type<select value={movementForm.movement_type} onChange={(event) => setMovementForm({ ...movementForm, movement_type: event.target.value as typeof movementForm.movement_type, create_expense: event.target.value === "purchase" })}>{MOVEMENT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
              <label>Quantity<input type="number" min="0.0001" step="0.0001" value={movementForm.quantity} onChange={(event) => setMovementForm({ ...movementForm, quantity: event.target.value })} required /></label>
              {MOVEMENT_OPTIONS.find((entry) => entry.value === movementForm.movement_type)?.direction === "in" ? <label>Unit cost<input type="number" min="0" step="0.0001" value={movementForm.unit_cost} onChange={(event) => setMovementForm({ ...movementForm, unit_cost: event.target.value })} required={movementForm.movement_type === "purchase"} /></label> : null}
              {MOVEMENT_OPTIONS.find((entry) => entry.value === movementForm.movement_type)?.direction === "in" ? <label>Currency<select value={movementForm.currency} onChange={(event) => setMovementForm({ ...movementForm, currency: event.target.value })}>{CURRENCY_CODES.map((code) => <option value={code} key={code}>{currencySymbol(code)} {code} — {currencyName(code)}</option>)}</select></label> : null}
              <label>Supplier<select value={movementForm.supplier_id} onChange={(event) => { const supplier = suppliers.find((entry) => entry.id === event.target.value); setMovementForm({ ...movementForm, supplier_id: event.target.value, currency: supplier?.default_currency ?? movementForm.currency }); }}><option value="">No supplier</option>{suppliers.filter((supplier) => supplier.status === "active").map((supplier) => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
              <label>Movement date<input type="date" value={movementForm.movement_date} onChange={(event) => setMovementForm({ ...movementForm, movement_date: event.target.value })} required /></label>
              <label>Movement time<input type="time" step="60" value={movementForm.movement_time} onChange={(event) => setMovementForm({ ...movementForm, movement_time: event.target.value })} required /></label>
              <label>Reference<input value={movementForm.reference} onChange={(event) => setMovementForm({ ...movementForm, reference: event.target.value })} placeholder="Order, invoice or adjustment reference" /></label>
              {movementForm.movement_type === "purchase" ? <label className={`${styles.checkLabel} ${styles.fullWidth}`}><input type="checkbox" checked={movementForm.create_expense} onChange={(event) => setMovementForm({ ...movementForm, create_expense: event.target.checked })} />Also create a Business expense for Cost Control</label> : null}
              {movementForm.movement_type === "purchase" && movementForm.create_expense ? <>
                <label>Cost category<select value={movementForm.cost_category_id} onChange={(event) => setMovementForm({ ...movementForm, cost_category_id: event.target.value })}>{initialCostCategories.filter((category) => category.is_active).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
                <label>Cost centre<select value={movementForm.cost_centre_id} onChange={(event) => setMovementForm({ ...movementForm, cost_centre_id: event.target.value })}><option value="">No cost centre</option>{initialCostCentres.filter((centre) => centre.is_active).map((centre) => <option value={centre.id} key={centre.id}>{centre.name}</option>)}</select></label>
                <label>Payment method<select value={movementForm.payment_method} onChange={(event) => setMovementForm({ ...movementForm, payment_method: event.target.value })}>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
              </> : null}
              <label className={styles.fullWidth}>Notes<textarea rows={3} value={movementForm.notes} onChange={(event) => setMovementForm({ ...movementForm, notes: event.target.value })} /></label>
            </div>
            <p className={styles.helpText}>{MOVEMENT_OPTIONS.find((entry) => entry.value === movementForm.movement_type)?.help}</p>
            {error ? <div className={styles.error}>{error}</div> : null}
            <button className={styles.primaryButton} disabled={busy === "movement"}>{busy === "movement" ? "Recording…" : "Record movement"}</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
