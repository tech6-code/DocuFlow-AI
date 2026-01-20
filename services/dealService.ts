import { supabase } from './supabase';
import { Deal, DealFollowUp, DealNote, DealDocument, DealHistoryItem } from '../types';
import { userService } from './userService';

export const dealService = {
    async getDeals(): Promise<Deal[]> {
        const { data, error } = await supabase
            .from('deals')
            .select('*')
            .order('deal_date', { ascending: false });

        if (error) {
            console.error('Error fetching deals:', error);
            return [];
        }

        return (data || []).map(mapFromDb);
    },

    async createDeal(deal: Omit<Deal, 'id'> & { userId?: string }): Promise<Deal | null> {
        const dealData = mapToDb(deal);

        // Add user_id if provided
        if (deal.userId) {
            dealData.user_id = deal.userId;
        }

        const { data, error } = await supabase
            .from('deals')
            .insert([dealData])
            .select()
            .single();

        if (error) {
            console.error('Error creating deal:', error);
            throw new Error(`Failed to create deal: ${error.message}`);
        }

        return mapFromDb(data);
    },

    async updateDeal(id: string, deal: Partial<Deal>): Promise<Deal | null> {
        const { data, error } = await supabase
            .from('deals')
            .update(mapToDb(deal))
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating deal:', error);
            throw new Error(`Failed to update deal: ${error.message}`);
        }

        return mapFromDb(data);
    },

    async deleteDeal(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('deals')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting deal:', error);
            throw new Error(`Failed to delete deal: ${error.message}`);
        }

        return true;
    },

    async getDealFollowUps(dealId: string): Promise<DealFollowUp[]> {
        const { data, error } = await supabase
            .from('deals_follow_up')
            .select('*')
            .eq('deal_id', dealId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching deal follow-ups:', error);
            return [];
        }

        return (data || []).map(mapFollowUpFromDb);
    },

    async createDealFollowUp(followUp: Partial<DealFollowUp>, userId: string): Promise<DealFollowUp | null> {
        const dbData = mapFollowUpToDb(followUp, userId);
        const { data, error } = await supabase
            .from('deals_follow_up')
            .insert([dbData])
            .select()
            .single();

        if (error) {
            console.error('Error creating deal follow-up:', error);
            throw new Error(`Failed to create follow-up: ${error.message}`);
        }

        return mapFollowUpFromDb(data);
    },

    async updateDealFollowUp(id: string, followUp: Partial<DealFollowUp>, userId: string): Promise<DealFollowUp | null> {
        const dbData = mapFollowUpToDb(followUp, userId);
        const { data, error } = await supabase
            .from('deals_follow_up')
            .update(dbData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating deal follow-up:', error);
            throw new Error(`Failed to update follow-up: ${error.message}`);
        }

        return mapFollowUpFromDb(data);
    },

    async deleteDealFollowUp(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('deals_follow_up')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting deal follow-up:', error);
            throw new Error(`Failed to delete follow-up: ${error.message}`);
        }

        return true;
    },

    async getDealNotes(dealId: string): Promise<DealNote[]> {
        const { data, error } = await supabase
            .from('deals_notes')
            .select('*')
            .eq('deal_id', dealId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching deal notes:', error);
            return [];
        }

        return (data || []).map(mapNoteFromDb);
    },

    async createDealNote(note: Partial<DealNote>, userId: string): Promise<DealNote | null> {
        const dbData = mapNoteToDb(note, userId);
        const { data, error } = await supabase
            .from('deals_notes')
            .insert([dbData])
            .select()
            .single();

        if (error) {
            console.error('Error creating deal note:', error);
            throw new Error(`Failed to create note: ${error.message}`);
        }

        return mapNoteFromDb(data);
    },

    async updateDealNote(id: string, note: Partial<DealNote>, userId: string): Promise<DealNote | null> {
        const dbData = mapNoteToDb(note, userId);
        const { data, error } = await supabase
            .from('deals_notes')
            .update(dbData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating deal note:', error);
            throw new Error(`Failed to update note: ${error.message}`);
        }

        return mapNoteFromDb(data);
    },

    async deleteDealNote(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('deals_notes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting deal note:', error);
            throw new Error(`Failed to delete note: ${error.message}`);
        }

        return true;
    },

    async getDealDocuments(dealId: string): Promise<DealDocument[]> {
        const { data, error } = await supabase
            .from('deals_documents')
            .select('*')
            .eq('deal_id', dealId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching deal documents:', error);
            return [];
        }

        return (data || []).map(mapDocumentFromDb);
    },

    async uploadDealDocument(dealId: string, file: File, userId: string): Promise<DealDocument | null> {
        // 1. Upload to Storage
        const filePath = `${dealId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
            .from('deal-documents')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading file to storage:', uploadError);
            throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        // 2. Create DB Record
        const dbData = {
            deal_id: dealId,
            uploader_id: userId,
            document_type: file.type,
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            content_type: file.type,
            created_at: new Date().toISOString()
        };

        const { data, error: dbError } = await supabase
            .from('deals_documents')
            .insert([dbData])
            .select()
            .single();

        if (dbError) {
            console.error('Error creating document record:', dbError);
            // Cleanup upload if DB fails
            await supabase.storage.from('deal-documents').remove([filePath]);
            throw new Error(`Failed to save document record: ${dbError.message}`);
        }

        return mapDocumentFromDb(data);
    },

    async deleteDealDocument(id: string, filePath: string): Promise<boolean> {
        // 1. Delete from Storage
        const { error: storageError } = await supabase.storage
            .from('deal-documents')
            .remove([filePath]);

        if (storageError) {
            console.error('Error deleting file from storage:', storageError);
            // Continue to delete DB record even if storage fails (orphan cleanup)
        }

        // 2. Delete DB Record
        const { error: dbError } = await supabase
            .from('deals_documents')
            .delete()
            .eq('id', id);

        if (dbError) {
            console.error('Error deleting document record:', dbError);
            throw new Error(`Failed to delete document record: ${dbError.message}`);
        }

        return true;
    },

    async getDealHistory(dealId: string): Promise<DealHistoryItem[]> {
        const history: DealHistoryItem[] = [];

        // Fetch FollowUps
        const followUps = await this.getDealFollowUps(dealId);
        // Fetch Notes
        const notes = await this.getDealNotes(dealId);
        // Fetch Documents
        const documents = await this.getDealDocuments(dealId);
        // Fetch Deal Creation/updates (Simplified: just referencing creation if possible,
        // but deals table might not have user_id for creator easily available or history table.
        // For now, we aggregate sub-items).

        // Helper to get user name
        const getUserName = async (userId: string) => {
            if (!userId) return 'Unknown User';
            const user = await userService.getUserProfile(userId);
            return user ? user.name : 'Unknown User';
        };

        // Cache user names locally for this request
        const userIdMap: Record<string, string> = {};
        const resolveUser = async (userId: string) => {
            if (userIdMap[userId]) return userIdMap[userId];
            const name = await getUserName(userId);
            userIdMap[userId] = name;
            return name;
        };

        // Process FollowUps
        // Note: deals_follow_up table has 'created_by' but our type might not have it exposed directly in `DealFollowUp` interface
        // except via mapping. Let's assume `mapFollowUpFromDb` doesn't include it currently effectively.
        // Wait, `mapFollowUpFromDb` maps `created_by`? No, it doesn't.
        // I need to check `mapFollowUpFromDb` and `DealFollowUp` type.
        // `DealFollowUp` has no `userId`. I need to fix that or fetch raw data.
        // Actually `getDealFollowUps` calls `mapFollowUpFromDb`.
        // I should probably fetch raw data here for history construction to get user_ids.

        const { data: rawFollowUps } = await supabase.from('deals_follow_up').select('*').eq('deal_id', dealId);
        const { data: rawNotes } = await supabase.from('deals_notes').select('*').eq('deal_id', dealId);
        const { data: rawDocs } = await supabase.from('deals_documents').select('*').eq('deal_id', dealId);

        if (rawFollowUps) {
            for (const f of rawFollowUps) {
                const userName = await resolveUser(f.created_by || f.user_id);
                history.push({
                    id: f.id,
                    type: 'FollowUp',
                    action: 'created',
                    date: f.created_at,
                    userId: f.created_by || f.user_id,
                    userName: userName,
                    details: f.remarks,
                    metadata: { status: f.status }
                });
            }
        }

        if (rawNotes) {
            for (const n of rawNotes) {
                const userName = await resolveUser(n.user_id);
                history.push({
                    id: n.id,
                    type: 'Note',
                    action: 'created',
                    date: n.created_at,
                    userId: n.user_id,
                    userName: userName,
                    details: n.note_details, // This is HTML
                    metadata: { title: n.note_title }
                });
            }
        }

        if (rawDocs) {
            for (const d of rawDocs) {
                const userName = await resolveUser(d.uploader_id);
                history.push({
                    id: d.id,
                    type: 'Document',
                    action: 'uploaded',
                    date: d.created_at,
                    userId: d.uploader_id,
                    userName: userName,
                    details: d.file_name,
                    metadata: { size: d.file_size, type: d.content_type }
                });
            }
        }

        // Sort by date desc
        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
};

// Mappers to handle camelCase (frontend) vs snake_case (database) conversion
function mapToDb(deal: Partial<Deal> | any): any {
    const mapped: any = {};

    // Map fields according to actual database schema
    if (deal.cifNumber !== undefined) mapped.cif = deal.cifNumber;
    if (deal.date !== undefined) mapped.deal_date = deal.date || null;
    if (deal.name !== undefined) mapped.name = deal.name;
    if (deal.companyName !== undefined) mapped.company_name = deal.companyName;
    if (deal.brand !== undefined) mapped.brand = deal.brand || null;
    if (deal.contactNo !== undefined) mapped.contact_number = deal.contactNo;
    if (deal.email !== undefined) mapped.email = deal.email;
    if (deal.leadSource !== undefined) mapped.lead_source = deal.leadSource || null;
    if (deal.services !== undefined) mapped.service = deal.services || null;
    if (deal.serviceClosed !== undefined) mapped.service_closed = deal.serviceClosed === 'Yes';
    if (deal.serviceAmount !== undefined) mapped.service_amount = deal.serviceAmount || 0;
    if (deal.closingDate !== undefined) mapped.closing_date = deal.closingDate || null;
    if (deal.paymentStatus !== undefined) mapped.payment_status = deal.paymentStatus;
    if (deal.custom_data !== undefined) mapped.custom_data = deal.custom_data;

    return mapped;
}

function mapFromDb(dbDeal: any): Deal {
    return {
        id: dbDeal.id,
        cifNumber: dbDeal.cif || '',
        date: dbDeal.deal_date || '',
        name: dbDeal.name || '',
        companyName: dbDeal.company_name || '',
        brand: dbDeal.brand || '',
        contactNo: dbDeal.contact_number || '',
        email: dbDeal.email || '',
        leadSource: dbDeal.lead_source || '',
        services: dbDeal.service || '',
        serviceClosed: dbDeal.service_closed ? 'Yes' : 'No',
        serviceAmount: dbDeal.service_amount || 0,
        closingDate: dbDeal.closing_date || '',
        paymentStatus: dbDeal.payment_status || 'Pending',
        custom_data: dbDeal.custom_data
    };
}

// Follow Up Mappers
function mapFollowUpToDb(followUp: Partial<DealFollowUp>, userId: string): any {
    return {
        deal_id: followUp.dealId,
        user_id: userId,
        follow_up: followUp.nextFollowUp,
        start_time: followUp.startTime,
        send_remainder: followUp.sendReminder, // Note: DB column is 'send_remainder'
        remind_before_value: followUp.remindBefore,
        remind_before_unit: followUp.remindUnit,
        remarks: followUp.remark,
        status: followUp.status,
        created_by: userId
    };
}

function mapFollowUpFromDb(dbFollowUp: any): DealFollowUp {
    return {
        id: dbFollowUp.id,
        dealId: dbFollowUp.deal_id,
        created: dbFollowUp.created_at,
        nextFollowUp: dbFollowUp.follow_up,
        startTime: dbFollowUp.start_time,
        sendReminder: dbFollowUp.send_remainder,
        remindBefore: dbFollowUp.remind_before_value,
        remindUnit: dbFollowUp.remind_before_unit,
        remark: dbFollowUp.remarks,
        status: dbFollowUp.status
    };
}

// Note Mappers
function mapNoteToDb(note: Partial<DealNote>, userId: string): any {
    return {
        deal_id: note.dealId,
        user_id: userId,
        note_title: note.title,
        note_details: note.detail
    };
}

function mapNoteFromDb(dbNote: any): DealNote {
    return {
        id: dbNote.id,
        dealId: dbNote.deal_id,
        title: dbNote.note_title,
        detail: dbNote.note_details,
        created: dbNote.created_at
    };
}

function mapDocumentFromDb(dbDoc: any): DealDocument {
    return {
        id: dbDoc.id,
        dealId: dbDoc.deal_id,
        uploaderId: dbDoc.uploader_id,
        documentType: dbDoc.document_type,
        filePath: dbDoc.file_path,
        fileName: dbDoc.file_name,
        fileSize: dbDoc.file_size,
        contentType: dbDoc.content_type,
        createdAt: dbDoc.created_at
    };
}
