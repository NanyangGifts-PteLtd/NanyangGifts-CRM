export type ClientStatus =
  | "New Lead"
  | "Contacted"
  | "Quoted"
  | "Failed"
  | "Overdue"
  | "Follow Up"
  | "Shortlisted"
  | "Project Started"
  | "Project Done"
  | "Closed"
  | "Unqualified";

export type ReplyStatus = "Waiting..." | "Replied";

export type SubitemStatus =
  | "To Quote"
  | "Verified"
  | "Awarded"
  | "Initial Quote"
  | "Quoted"
  | "Shortlisted"
  | "Failed"
  | "";

export type PaymentStatus = "Paid" | "To Pay" | "MISMATCH" | "Overdue";
export type TimelineProgress = "Pending" | "Started" | "Done" | "Overdue";
export type SampleStatus =
  | "Ready to collect"
  | "Return arranged"
  | "Extended"
  | "Chased"
  | "Must return"
  | "Request to not return"
  | "No return needed"
  | "Failed"
  | "Overdue";
export type SampleType = "Product sample" | "Pre-production sample";
export type SampleOrderStatus =
  | "Pending"
  | "To order"
  | "Ordered"
  | "Delivered"
  | "Paid"
  | "Shipped"
  | "Failed";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  role?: string | null;
};

export interface SampleRow {
  status: string;
  type: string;
  returnByDate: string;
  returnedDate: string;
  sentDate: string;
}

export interface TimelineRow {
  id: string;
  /** User-added rows may be removed; the standard workflow rows may not. */
  isCustom?: boolean;
  name: string;
  person: string;
  remarks: string;
  numOfCartons: string;
  subProgress: TimelineProgress | string;
  subProgressOptionId?: string | null;
  timelineStart: string;
  timelineEnd: string;
  duration: string;
  dependency: string;
}

export interface TimelineGroup {
  id: string;
  cnTracking: string;
  sgTracking: string;
  rows: TimelineRow[];
  /** The original imported timeline remains protected. */
  isDefault?: boolean;
}

export interface PaymentRow {
  id: string;
  position: number;
  amount: string;
  orderNumber: string;
  paymentReceived: boolean | null;
  /** Display value from the managed Payment received? label group. */
  paymentReceivedLabel?: string;
  paymentReceivedOptionId?: string | null;
  modeOfPayment: string;
  modeOfPaymentOptionId?: string | null;
}

export interface Subitem {
  id: string;
  /** Immutable, human-readable identifier for staff-facing selection. */
  displayId: string;
  createdAt: string | null;
  /** Persisted order within the owning client. */
  position: number;
  name: string;
  people: string;
  status: SubitemStatus | string;
  statusOptionId?: string | null;
  localOverseas: string;
  localOverseasOptionId?: string | null;
  qty: string;
  description: string;
  remarks: string;
  shipper: string;
  shipperOptionId?: string | null;
  shipperId: string | null;
  supplier: string;
  cost: string;
  manpower: string;
  ls: string;
  os: string;
  currency: string;
  currencyOptionId?: string | null;
  cSgd: string;
  tc: string;
  uc: string;
  tcSgd: string;
  price: string;
  up: string;
  numOfCartons: string;
  cnTracking: string;
  sgTracking: string;
  pl: string;
  sl: string;
  customFields?: Record<string, string>;

  // Payment fields
  owner: string;
  payment: string;
  paymentOptionId?: string | null;
  paymentStatus: string;
  paymentStatusOptionId?: string | null;
  totalUc: string;
  lsRmb: string;
  manpowerRmb: string;
  totalC: string;
  modeOfPayment: string;
  modeOfPaymentOptionId?: string | null;
  orderNumber: string;
  quantityProduced: string;
  qtyFree: string;
  sample: string;
  qtyTotal: string;
  qtyWeKeep: string;
  qtyFor: string;
  paymentAmount: string;
  difference: string;
  paymentRemarks: string;
  paymentRows: PaymentRow[];

  // Timeline
  timelineRows: TimelineRow[];
  timelineGroups: TimelineGroup[];
  showTimeline: boolean;
  showPayments: boolean;
  showSample: boolean;

  //Sample
  sampleRows: SampleRow[];
  sampleOrderStatus: SampleOrderStatus | string;
  sampleStatus: SampleStatus | string;
  sampleType: SampleType | string;
}

export type ActivityEntry = {
  id: string;
  clientId?: string;
  action:
    | "field_changed"
    | "assignment_changed"
    | "client_added"
    | "client_deleted"
    | "client_restored"
    | "subitem_added"
    | "subitem_deleted"
    | "subitem_restored"
    | "subitem_field_changed"
    | "ocf_created"
    | "ocf_signed"
    | "ocf_updated"
    | "estimate_created"
    | "file_uploaded"
    | "file_replaced"
    | "file_removed"
    | "shipper_pushed";
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  actorName: string;
  createdAt: string;
  waitingStartedAt?: string | null;
  subitemId?: string;
  subitemName?: string;
  link?: string | null;
  title?: string | null;
  description?: string | null;
  meta?: Record<string, any> | null;
};

export interface Client {
  id: string;
  /** Immutable, human-readable identifier for staff-facing selection. */
  displayId: string;
  name: string;
  people: string;
  replyStatus: string;
  replyStatusOptionId?: string | null;
  followUp: string;
  status: ClientStatus;
  statusOptionId?: string | null;
  channel: string;
  channelOptionId?: string | null;
  importance: string;
  importanceOptionId?: string | null;
  progress: string;
  progressOptionId?: string | null;
  company: string;
  email: string;
  phone: string;
  requirements: string;
  unqualifiedReason: string;
  nbd: string;
  totalPrice: string;
  createdAt: string;
  waitingStartedAt?: string | null;
  billingAddress: string;
  expanded: boolean;
  color: string;
  groupId: string | null;
  subitems: Subitem[];
  activityLog?: ActivityEntry[];
  assignedProfileIds?: string[];
  customFields?: Record<string, string>;
}
export type ClientAssigneeMap = Record<string, string[]>;

export type SubitemAssigneeMap = Record<string, string[]>;

export type CRMGroup = {
  id: string;
  name: string;
  color?: string | null;
  sort_order: number;
};

export interface Email {
  id: string;
  from: string;
  subject: string;
  preview: string;
  body: string;
  date: string;
  read: boolean;
  clientId?: string;
}

export interface Notification {
  id: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "warning" | "success" | "error";
}

export type SearchResult = {
  id: string;
  clientId: string;
  subitemId?: string;
  kind: "client" | "subitem" | "payment" | "timeline";
  label: string;
  context: string;
  field: string;
  value: string;
  query: string;
  score?: number;
};
