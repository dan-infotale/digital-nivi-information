export const translations = {
  en: {
    // Nav
    monitoring: 'Monitoring', configuration: 'Configuration', management: 'Management',
    conversations: 'Conversations', connectors: 'Connectors', meta_connections: 'META Connections',
    custom_agents: 'Custom Agents', knowledge_bases: 'Knowledge Bases',
    tenants: 'Tenants', system_admins: 'System Admins', system_settings: 'System Settings',
    logout: 'Logout', system_admin: 'System Admin',

    // Common
    save: 'Save', cancel: 'Cancel', edit: 'Edit', delete: 'Delete', test: 'Test',
    name: 'Name', email: 'Email', password: 'Password', actions: 'Actions',
    new: 'New', back: '← Back', copy: 'Copy', copied: '✓ Copied',
    sign_in: 'Sign in', signing_in: 'Signing in...', sign_in_microsoft: 'Sign in with Microsoft',
    or: 'or',

    // Login
    select_org: 'Select your organization to continue',
    no_orgs: 'No organizations found',
    sign_in_as_admin: 'Sign in as system admin',
    sign_in_to_continue: 'Sign in to continue',

    // Conversations
    all_conversations: 'All Conversations', all_connectors: 'All connectors',
    no_conversations: 'No conversations yet', select_conversation: 'Select a conversation to view messages',
    total: 'Total', today: 'Today', messages: 'Messages',
    user_msgs: 'User', bot_msgs: 'Bot',
    delete_conversation: 'Delete this conversation?',
    active: 'Active', closed: 'Closed',

    // META Connections
    new_connection: 'New Connection', no_meta: 'No META connections yet',
    no_connectors_linked: 'No connectors linked — create a connector to get a webhook URL.',
    edit_connection: 'Edit Connection', new_meta: 'New META Connection',
    api_url: 'API URL', token: 'Token', token_keep: '(leave blank to keep current)',
    phone_number_id: 'Phone Number ID', verify_token: 'Webhook Verify Token',

    // BotBackends
    new_agent: 'New Agent', no_agents: 'No agents yet',
    edit_agent: 'Edit Agent', type: 'Type', provider_url: 'Provider / URL',
    base_url: 'Base URL', api_key: 'API Key',
    llm_provider: 'LLM Provider', select_provider: '— Select provider —',
    system_prompt: 'System Prompt', temperature: 'Temperature (0–2)',
    rag_optional: 'RAG (optional)', top_k: 'Top-K results', knowledge_base: 'Knowledge Base',
    no_kb: '— None —', no_providers_warn: 'No LLM providers configured. Ask your system admin to add providers in System Settings.',

    // Connectors
    new_connector: 'New Connector', no_connectors: 'No connectors yet — create one to link a WhatsApp number to a bot.',
    edit_connector: 'Edit Connector', webhook: 'Webhook', inactive: 'Inactive',
    meta_connection: 'META Connection', bot_backend: 'Bot Backend',

    // Knowledge Bases
    new_kb: 'New Knowledge Base', no_kbs: 'No knowledge bases yet',
    edit_kb: 'Edit Knowledge Base', docs: 'Docs', documents: 'Documents',
    uploading: 'Uploading...', click_to_upload: 'Click to upload a document',
    file_types: '.txt or .pdf files', filename: 'Filename', chunks: 'Chunks', uploaded: 'Uploaded',
    no_docs: 'No documents yet', delete_kb: 'Delete this knowledge base?', delete_doc: 'Delete this document?',

    // Admin - Tenants
    new_tenant: 'New Tenant', edit_tenant: 'Edit Tenant', no_tenants: 'No tenants yet',
    slug: 'Slug', users: 'Users', manage_users: 'Manage Users',
    add_user: 'Add User', no_users: 'No users yet', delete_tenant_confirm: 'Delete tenant? This does not delete associated data.',

    // Admin - System Admins
    new_admin: 'New Admin', edit_admin: 'Edit Admin', no_admins: 'No admins yet',

    // Admin - Settings
    embedding_config: 'Embedding Configuration', llm_providers: 'LLM Providers',
    add_provider: 'Add Provider', edit_provider: 'Edit Provider', no_providers: 'No providers yet',
    model: 'Model', saved: 'Saved!', saving: 'Saving...', save_settings: 'Save Settings',

    // Errors
    not_registered: 'Your Microsoft account is not registered in this system. Contact your administrator.',
    auth_failed: 'Microsoft authentication failed. Please try again.',
  },
  he: {
    // Nav
    monitoring: 'ניטור', configuration: 'הגדרות', management: 'ניהול',
    conversations: 'שיחות', connectors: 'מחברים', meta_connections: 'חיבורי META',
    custom_agents: 'סוכנים', knowledge_bases: 'בסיסי ידע',
    tenants: 'ארגונות', system_admins: 'מנהלי מערכת', system_settings: 'הגדרות מערכת',
    logout: 'התנתק', system_admin: 'מנהל מערכת',

    // Common
    save: 'שמור', cancel: 'ביטול', edit: 'עריכה', delete: 'מחק', test: 'בדוק',
    name: 'שם', email: 'אימייל', password: 'סיסמה', actions: 'פעולות',
    new: 'חדש', back: '→ חזרה', copy: 'העתק', copied: '✓ הועתק',
    sign_in: 'כניסה', signing_in: 'מתחבר...', sign_in_microsoft: 'כניסה עם Microsoft',
    or: 'או',

    // Login
    select_org: 'בחר ארגון להמשך',
    no_orgs: 'לא נמצאו ארגונים',
    sign_in_as_admin: 'כניסה כמנהל מערכת',
    sign_in_to_continue: 'כניסה להמשך',

    // Conversations
    all_conversations: 'כל השיחות', all_connectors: 'כל המחברים',
    no_conversations: 'אין שיחות עדיין', select_conversation: 'בחר שיחה לצפייה בהודעות',
    total: 'סה״כ', today: 'היום', messages: 'הודעות',
    user_msgs: 'משתמש', bot_msgs: 'בוט',
    delete_conversation: 'למחוק שיחה זו?',
    active: 'פעיל', closed: 'נסגר',

    // META Connections
    new_connection: 'חיבור חדש', no_meta: 'אין חיבורי META עדיין',
    no_connectors_linked: 'אין מחברים מקושרים — צור מחבר כדי לקבל כתובת webhook.',
    edit_connection: 'עריכת חיבור', new_meta: 'חיבור META חדש',
    api_url: 'כתובת API', token: 'טוקן', token_keep: '(השאר ריק לשמור הנוכחי)',
    phone_number_id: 'מזהה מספר טלפון', verify_token: 'טוקן אימות Webhook',

    // BotBackends
    new_agent: 'סוכן חדש', no_agents: 'אין סוכנים עדיין',
    edit_agent: 'עריכת סוכן', type: 'סוג', provider_url: 'ספק / כתובת',
    base_url: 'כתובת בסיס', api_key: 'מפתח API',
    llm_provider: 'ספק LLM', select_provider: '— בחר ספק —',
    system_prompt: 'הנחיית מערכת', temperature: 'טמפרטורה (0–2)',
    rag_optional: 'RAG (אופציונלי)', top_k: 'תוצאות Top-K', knowledge_base: 'בסיס ידע',
    no_kb: '— ללא —', no_providers_warn: 'אין ספקי LLM. בקש ממנהל המערכת להוסיף ספקים בהגדרות המערכת.',

    // Connectors
    new_connector: 'מחבר חדש', no_connectors: 'אין מחברים עדיין — צור מחבר לקישור מספר WhatsApp לבוט.',
    edit_connector: 'עריכת מחבר', webhook: 'Webhook', inactive: 'לא פעיל',
    meta_connection: 'חיבור META', bot_backend: 'בוט',

    // Knowledge Bases
    new_kb: 'בסיס ידע חדש', no_kbs: 'אין בסיסי ידע עדיין',
    edit_kb: 'עריכת בסיס ידע', docs: 'מסמכים', documents: 'מסמכים',
    uploading: 'מעלה...', click_to_upload: 'לחץ להעלאת מסמך',
    file_types: 'קבצי .txt או .pdf', filename: 'שם קובץ', chunks: 'קטעים', uploaded: 'הועלה',
    no_docs: 'אין מסמכים עדיין', delete_kb: 'למחוק בסיס ידע זה?', delete_doc: 'למחוק מסמך זה?',

    // Admin - Tenants
    new_tenant: 'ארגון חדש', edit_tenant: 'עריכת ארגון', no_tenants: 'אין ארגונים עדיין',
    slug: 'מזהה', users: 'משתמשים', manage_users: 'נהל משתמשים',
    add_user: 'הוסף משתמש', no_users: 'אין משתמשים עדיין', delete_tenant_confirm: 'למחוק ארגון? פעולה זו אינה מוחקת את הנתונים המשויכים.',

    // Admin - System Admins
    new_admin: 'מנהל חדש', edit_admin: 'עריכת מנהל', no_admins: 'אין מנהלים עדיין',

    // Admin - Settings
    embedding_config: 'הגדרות Embedding', llm_providers: 'ספקי LLM',
    add_provider: 'הוסף ספק', edit_provider: 'עריכת ספק', no_providers: 'אין ספקים עדיין',
    model: 'מודל', saved: 'נשמר!', saving: 'שומר...', save_settings: 'שמור הגדרות',

    // Errors
    not_registered: 'חשבון Microsoft שלך אינו רשום במערכת. פנה למנהל.',
    auth_failed: 'אימות Microsoft נכשל. נסה שנית.',
  },
};

export function t(lang, key) {
  return translations[lang]?.[key] ?? translations.en[key] ?? key;
}
