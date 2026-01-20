import { supabase } from "./supabase";
import { CtType, CtFilingPeriod } from "../types";

const mapFilingPeriodFromDb = (row: any): CtFilingPeriod => ({
  id: row.id,
  userId: row.user_id,
  customerId: row.customer_id,
  ctTypeId: row.ct_type_id,
  periodFrom: row.period_from,
  periodTo: row.period_to,
  dueDate: row.due_date,
  status: row.status,
  createdAt: row.created_at,
});

const mapFilingPeriodToDb = (
  period: Omit<CtFilingPeriod, "id" | "createdAt">,
) => ({
  user_id: period.userId,
  customer_id: period.customerId,
  ct_type_id: period.ctTypeId,
  period_from: period.periodFrom,
  period_to: period.periodTo,
  due_date: period.dueDate,
  status: period.status,
});

export const ctFilingService = {
  async getCtTypes(): Promise<CtType[]> {
    const { data, error } = await supabase.from("ct_types").select("*");

    if (error) {
      console.error("Error fetching CT types:", error);
      return [];
    }
    return data || [];
  },

  async getFilingPeriods(
    customerId: string,
    ctTypeId: string,
  ): Promise<CtFilingPeriod[]> {
    const { data, error } = await supabase
      .from("ct_filing_period")
      .select("*")
      .eq("customer_id", customerId)
      .eq("ct_type_id", ctTypeId)
      .order("period_from", { ascending: false });

    if (error) {
      console.error("Error fetching filing periods:", error);
      return [];
    }
    return (data || []).map(mapFilingPeriodFromDb);
  },

  async addFilingPeriod(
    period: Omit<CtFilingPeriod, "id" | "createdAt">,
  ): Promise<CtFilingPeriod | null> {
    const dbPayload = mapFilingPeriodToDb(period);
    const { data, error } = await supabase
      .from("ct_filing_period")
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      console.error("Error adding filing period:", error);
      throw new Error(error.message);
    }
    return mapFilingPeriodFromDb(data);
  },

  async getFilingPeriodById(periodId: string): Promise<CtFilingPeriod | null> {
    const { data, error } = await supabase
      .from("ct_filing_period")
      .select("*")
      .eq("id", periodId)
      .single();

    if (error) {
      console.error("Error fetching filing period by id:", error);
      return null;
    }
    return mapFilingPeriodFromDb(data);
  },

  async deleteFilingPeriod(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("ct_filing_period")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting filing period:", error);
      throw new Error(error.message);
    }
    return true;
  },

  async updateFilingPeriod(
    id: string,
    updates: Partial<CtFilingPeriod>,
  ): Promise<CtFilingPeriod | null> {
    const dbPayload: any = {};
    if (updates.periodFrom) dbPayload.period_from = updates.periodFrom;
    if (updates.periodTo) dbPayload.period_to = updates.periodTo;
    if (updates.dueDate) dbPayload.due_date = updates.dueDate;
    if (updates.status) dbPayload.status = updates.status;

    const { data, error } = await supabase
      .from("ct_filing_period")
      .update(dbPayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating filing period:", error);
      throw new Error(error.message);
    }
    return mapFilingPeriodFromDb(data);
  },
};
