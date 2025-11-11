/**
 * Fridge Items Service
 * Manages user's fridge/pantry items with expiry dates
 */

import { supabase } from '../lib/supabase';
import { AuthService } from './auth.service';

export interface FridgeItem {
  id?: string;
  user_id?: string;
  name: string;
  quantity?: number;
  unit?: string;
  expiry_date?: string; // YYYY-MM-DD
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export class FridgeItemsService {
  private static instance: FridgeItemsService;

  public static getInstance(): FridgeItemsService {
    if (!FridgeItemsService.instance) {
      FridgeItemsService.instance = new FridgeItemsService();
    }
    return FridgeItemsService.instance;
  }

  /**
   * Get all fridge items for current user
   */
  async getFridgeItems(): Promise<FridgeItem[]> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('fridge_items')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('expiry_date', { ascending: true, nullsLast: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[FridgeItems] Error fetching items:', error);
      throw error;
    }
  }

  /**
   * Add or update fridge item
   */
  async upsertFridgeItem(item: Omit<FridgeItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<FridgeItem> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Check if item with same name exists (case-insensitive)
      const { data: existing } = await supabase
        .from('fridge_items')
        .select('*')
        .eq('user_id', currentUser.id)
        .ilike('name', item.name)
        .single();

      if (existing) {
        // Update existing item
        const { data, error } = await supabase
          .from('fridge_items')
          .update({
            quantity: item.quantity ?? existing.quantity,
            unit: item.unit ?? existing.unit,
            expiry_date: item.expiry_date ?? existing.expiry_date,
            notes: item.notes ?? existing.notes,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new item
        const { data, error } = await supabase
          .from('fridge_items')
          .insert({
            user_id: currentUser.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            expiry_date: item.expiry_date,
            notes: item.notes,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('[FridgeItems] Error upserting item:', error);
      throw error;
    }
  }

  /**
   * Add multiple fridge items
   */
  async addFridgeItems(items: Array<Omit<FridgeItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<FridgeItem[]> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const results: FridgeItem[] = [];
      for (const item of items) {
        const result = await this.upsertFridgeItem(item);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error('[FridgeItems] Error adding items:', error);
      throw error;
    }
  }

  /**
   * Remove fridge item
   */
  async removeFridgeItem(itemId: string): Promise<void> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('fridge_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', currentUser.id);

      if (error) throw error;
    } catch (error) {
      console.error('[FridgeItems] Error removing item:', error);
      throw error;
    }
  }

  /**
   * Get items expiring soon (within N days)
   */
  async getExpiringItems(days: number = 3): Promise<FridgeItem[]> {
    try {
      const currentUser = await AuthService.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('fridge_items')
        .select('*')
        .eq('user_id', currentUser.id)
        .gte('expiry_date', today)
        .lte('expiry_date', futureDateStr)
        .order('expiry_date', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('[FridgeItems] Error fetching expiring items:', error);
      throw error;
    }
  }
}

export const fridgeItemsService = FridgeItemsService.getInstance();



