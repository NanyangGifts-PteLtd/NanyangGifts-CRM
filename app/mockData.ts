import { Client, Email, Notification, TimelineRow } from './types';

function makeTimelineRows(): TimelineRow[] {
  return [
    { id: `tl-${Math.random().toString(36).slice(2)}`, name: 'Sample', person: '',  remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '',   status: '' },
    { id: `tl-${Math.random().toString(36).slice(2)}`, name: 'Production', person: '',  remarks: '', subProgress: 'Done', timelineStart: '2024-06-04', timelineEnd: '2024-06-07', duration: '4', dependency: 'Sample',  status: '' },
    { id: `tl-${Math.random().toString(36).slice(2)}`, name: 'Check Production Status (+3 from production start)', person: '',  remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '', status: '' },
    { id: `tl-${Math.random().toString(36).slice(2)}`, name: 'Local Shipping', person: '',  remarks: '', subProgress: 'Started', timelineStart: '2024-06-07', timelineEnd: '2024-06-10', duration: '4', dependency: 'Production FS-1',  status: '' },
    { id: `tl-${Math.random().toString(36).slice(2)}`, name: 'Sea/Air Freight', person: '',  remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Local Shipping',  status: '' },
    { id: `tl-${Math.random().toString(36).slice(2)}`, name: 'Check Shipment Status (+3 from shipment start)', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '',   status: '' },
    { id: `tl-${Math.random().toString(36).slice(2)}`, name: 'NBD', person: '',  remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '',   status: '' },
  ];
}


export const initialClients: Client[] = [
  {
    id: 'c1', name: 'Mei Lin Yeo', people: 'P', replyStatus: 'Waiting...', 
    followUp: '',  status: 'Project Started', channel: 'Forms', importance: 'Medium',
    company: 'Bloomsbury Capital Investment', email: 'meilin@bloomsburypar.com', phone: '+65 96386403',
    requirements: 'We need to customise the books and cups with our logo', qty: '100', nbd: 'Apr 2',
    totalPrice: '1,720', companyAddress:'', billingAddress: '', dateCreated:'', expanded: false, color: '#845EC2',
    subitems: [
      {
        id: 's1', name: 'Book', people: '', status: '', qty: '50', description: 'NB 2498-II except BK no s...', remarks:'', shipper:'', supplier: 'SG Supplier A', cost: '3.9', ls: '', os: '90', tc: '184.935', uc: '3.699', tcSgd: '64.935', price: '445', up: '8.9', cnTracking:'', sgTracking:'',
        owner: '', paymentStatus: '', total: '445', manpower: '0', lsRmb: '0', totalC: '445', modeOfPayment: '', orderNumber: '', quantityProduced: '', sample: '', qtyFor: '', paymentAmount: '', difference: '', localOverseas:'Local', numOfCartons:'', paymentRemarks:'', 
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false, sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:''
      },
      {
        id: 's2', name: 'Cup', people: '', status: 'Verified', qty: '50', description: 'M 1048 - White RM 3.50/pc', supplier: 'SG Supplier B', cost: '3.5', ls: '', os: '90', tc: '181.615', uc: '3.632', tcSgd: '58.275', price: '400', up: '8', cnTracking:'', sgTracking:'',
        owner: '', shipper: '', paymentStatus: 'Paid', total: '400', manpower: '0', lsRmb: '0', totalC: '400', modeOfPayment: 'AliPay', orderNumber: '31729283810524', quantityProduced: '50', sample: '0', qtyFor: '50', paymentAmount: '400', difference: '0', localOverseas:'Local', numOfCartons:'', paymentRemarks:'',
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false, sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:'',remarks:''
      },
      {
        id: 's3', name: 'Book', people: '', status: '', qty: '50', description: '1c x 1 position', supplier: '', cost: '9.8', manpower: '', ls: '', os: '90', tc: '253.17', uc: '5.063', tcSgd: '163.17', price: '475', up: '9.5', cnTracking:'', sgTracking:'',
        owner: '', shipper: '', paymentStatus: '', total: '475', lsRmb: '0', totalC: '475', modeOfPayment: '', orderNumber: '', quantityProduced: '', sample: '', qtyFor: '', paymentAmount: '', difference: '', localOverseas:'Local', numOfCartons:'', paymentRemarks:'',
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false,sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:'',remarks:'',
      },
      {
        id: 's4', name: 'Cup', people: '', status: 'Verified', qty: '50', description: '1c x 1 position', supplier: '', cost: '6.4', manpower: '', ls: '', os: '90', tc: '106.56', uc: '2.131', tcSgd: '106.56', price: '400', up: '8', cnTracking:'', sgTracking:'',
        owner: '', shipper: '', paymentStatus: '', total: '400', lsRmb: '0', totalC: '400', modeOfPayment: '', orderNumber: '', quantityProduced: '', sample: '', qtyFor: '', paymentAmount: '', difference: '', localOverseas:'Local', numOfCartons:'', paymentRemarks:'',
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false,sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:'',remarks:'',
      },
    ],
  },
  {
    id: 'c2', name: 'Lara Walsh', people: 'JM KH', replyStatus: 'Waiting...', 
    followUp: '',  status: 'Project Done', channel: 'Email', importance: 'High',
    company: 'Bolt Insight Limited', email: 'lara.walsh@boltinsight.co.uk', phone: '+44 7442 924453',
    requirements: '', qty: '100', nbd: 'Oct 14, 2024', totalPrice: '800', companyAddress:'', billingAddress:'', dateCreated:'',
    expanded: false, color: '#2c73d2',
    subitems: [
      {
        id: 's5', name: 'Canvas Tote Bags', people: '', status: 'Awarded', qty: '100', description: 'Heat Transfer', supplier: 'https://dhgate.com/supplier', cost: '8', ls: '', os: '', tc: '', uc: '', tcSgd: '', price: '800', up: '8', cnTracking:'', sgTracking:'',
        owner: 'A5', shipper: 'DHL', paymentStatus: 'Paid', total: '800', manpower: '0', lsRmb: '0', totalC: '800', modeOfPayment: 'AliPay', orderNumber: '3294585660109524550', quantityProduced: '100', sample: '0', qtyFor: '100', paymentAmount: '800', difference: '0', localOverseas:'Local', numOfCartons:'', paymentRemarks:'',
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false, sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:'',remarks:'',
      },
    ],
  },
  {
    id: 'c3', name: 'Jane Lum', people: 'KH', replyStatus: 'Replied',
    followUp: '',  status: 'Project Started', channel: 'Referral', importance: 'High',
    company: 'Shilla Travel Retail Pte Ltd', email: 'JANE.LUM@shilla.sg', phone: '+65 61234567',
    requirements: 'Premium notebooks with branding', qty: '450', nbd: 'Jan 19, 2026', totalPrice: '6,370', companyAddress:'', billingAddress:'', dateCreated:'',
    expanded: false, color: '#0081cf',
    subitems: [
      {
        id: 's6', name: 'Premium Customisable Notebook w/ Box', people: '', status: 'Awarded', qty: '300', description: 'Full colour wrap', supplier: 'https://alibaba.com/supplier-a', cost: '16', ls: '', os: '', tc: '', uc: '', tcSgd: '', price: '4800', up: '16', cnTracking:'', sgTracking:'',
        owner: '小字', shipper: 'Sea Freight', paymentStatus: 'Paid', total: '4800', manpower: '44', lsRmb: '220', totalC: '5020', modeOfPayment: '1688', orderNumber: '3171292932810524550', quantityProduced: '300', sample: '0', qtyFor: '300', paymentAmount: '5020', difference: '0', localOverseas:'Local', numOfCartons:'', paymentRemarks:'',
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false, sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:'',remarks:'',
      },
      {
        id: 's7', name: 'Premium Customisable Notebook w/ Sleeve', people: '', status: 'Awarded', qty: '150', description: 'Embossed logo', supplier: 'https://alibaba.com/supplier-a', cost: '8.4', ls: '', os: '', tc: '', uc: '', tcSgd: '', price: '1260', up: '8.4', cnTracking:'', sgTracking:'',
        owner: '小字', shipper: 'Sea Freight', paymentStatus: 'Paid', total: '1260', manpower: '18', lsRmb: '90', totalC: '1350', modeOfPayment: '1688', orderNumber: '3194717232304524550', quantityProduced: '150', sample: '0', qtyFor: '150', paymentAmount: '1350', difference: '0', localOverseas:'Local', numOfCartons:'', paymentRemarks:'',
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false, sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:'',remarks:'',
      },
    ],
  },
  {
    id: 'c4', name: 'Ling Shu Mei', people: 'XH', replyStatus: 'Replied',
    followUp: '',  status: 'Quoted', channel: 'Whatsapp', importance: 'Medium',
    company: 'Ling Enterprises Pte Ltd', email: 'ling@lingenterprises.com', phone: '+86 138 0013 8888',
    requirements: 'Towel customization with full colour print', qty: '500', nbd: 'Jun 15, 2024', companyAddress:'', billingAddress:'', dateCreated:'',
    totalPrice: '', expanded: false, color: '#24819c',
    subitems: [
      {
        id: 's8', name: 'Towel (Set of 7)', people: 'XH', status: '', qty: '500', remarks: 'Full colour sublimation', supplier: 'CN Towel Factory', cost: '4.2', ls: '', os: '', tc: '', uc: '', tcSgd: '', price: '', up: '', cnTracking:'', sgTracking:'',
        owner: '', shipper: '', paymentStatus: '', total: '', manpower: '', lsRmb: '', totalC: '', modeOfPayment: '', orderNumber: '', quantityProduced: '', sample: '', qtyFor: '', paymentAmount: '', difference: '', localOverseas:'Local', numOfCartons:'', paymentRemarks:'', showSample:false, description:'', sampleRows:[], sampleOrderStatus:'', sampleStatus:'', sampleType:'',
        timelineRows: [
          { id: 'tl-a1', name: 'Sample', person: '',  subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '', remarks: '',  status: '' },
          { id: 'tl-a2', name: 'Production', person: 'XH',  subProgress: 'Done', timelineStart: '2024-06-04', timelineEnd: '2024-06-07', duration: '4', dependency: 'Sample', remarks: '',  status: '' },
          { id: 'tl-a3', name: 'Check Production Status (+3 from production start)', person: '', remarks: '', subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '',  status: '' },
          { id: 'tl-a4', name: 'Local Shipping', person: '',   subProgress: 'Started', timelineStart: '2024-06-07', timelineEnd: '2024-06-10', duration: '4', dependency: 'Production FS-1', remarks: '',  status: '' },
          { id: 'tl-a5', name: 'Sea/Air Freight', person: '',   subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: 'Local Shipping', remarks: '',  status: '' },
          { id: 'tl-a6', name: 'Check Shipment Status (+3 from shipment start)', person: '',  subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '', remarks: '',  status: '' },
          { id: 'tl-a7', name: 'NBD', person: '',  subProgress: '', timelineStart: '', timelineEnd: '', duration: '', dependency: '', remarks: '', status: '' },
        ],
        showTimeline: false, showPayments: false,
      },
    ],
  },
  {
    id: 'c5', name: 'Ahmad Hassan', people: 'P', replyStatus: 'Replied', 
    followUp: '2024-06-20',  status: 'New Lead', channel: 'Whatsapp', importance: 'Low',
    company: 'Hassan Trading Co.', email: 'ahmad@hassantrading.com', phone: '+65 91234567',
    requirements: 'Custom pen sets with company logo', qty: '200', nbd: '', companyAddress:'', billingAddress:'', dateCreated:'',
    totalPrice: '', expanded: false, color: '#008e9b',
    subitems: [
      {
        id: 's9', name: 'Custom Pen Set (Box of 3)', people: '', status: 'To Quote', qty: '200', description: 'Logo on clip, 1 colour', supplier: '', cost: '2.5', ls: '', os: '', tc: '', uc: '', tcSgd: '', price: '', up: '', cnTracking:'', sgTracking:'',
        owner: '', shipper: '', paymentStatus: '', total: '', manpower: '', lsRmb: '', totalC: '', modeOfPayment: '', orderNumber: '', quantityProduced: '', sample: '', qtyFor: '', paymentAmount: '', difference: '', localOverseas:'Local', numOfCartons:'', paymentRemarks:'',
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false,sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:'',remarks:'',
      },
    ],
  },
  {
    id: 'c6', name: 'Sarah Chen', people: '', replyStatus: 'Waiting...', 
    followUp: '',  status: 'Follow Up', channel: 'E-comm', importance: 'Medium',
    company: 'Chen & Associates', email: 'sarah.chen@chenassoc.com.sg', phone: '+65 87654321',
    requirements: 'Branded merchandise for company event', qty: '', nbd: '', 
    totalPrice: '', companyAddress:'', billingAddress:'', dateCreated:'', expanded: false, color: '#008f7a',
    subitems: [],
  },
  {
    id: 'c7', name: 'Marcus Tan', people: 'JM', replyStatus: 'Replied', 
    followUp: '',  status: 'Shortlisted', channel: 'Referral', importance: 'High',
    company: 'Tan Brothers Holdings', email: 'marcus.tan@tanbrothers.sg', phone: '+65 98765432',
    requirements: 'Corporate gifts for AGM - 500 pax', qty: '500', nbd: 'Aug 15', companyAddress:'', billingAddress:'', dateCreated:'',
    totalPrice: '4,500', expanded: false, color: '#4e8397',
    subitems: [
      {
        id: 's10', name: 'Leather Portfolio', people: 'JM', status: 'Verified', qty: '500', description: 'Deboss logo, tan leather', supplier: 'CN Leather Co.', cost: '7.5', ls: '', os: '90', tc: '420', uc: '8.4', tcSgd: '120', price: '3750', up: '7.5', cnTracking:'', sgTracking:'',
        owner: 'JM', shipper: '', paymentStatus: 'To Pay', total: '3750', manpower: '50', lsRmb: '150', totalC: '3900', modeOfPayment: '', orderNumber: '', quantityProduced: '', sample: '5', qtyFor: '500', paymentAmount: '', difference: '', localOverseas:'Local', numOfCartons:'', paymentRemarks:'',
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false,sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:'',remarks:'',
      },
      {
        id: 's11', name: 'Metal Pen', people: '', status: 'Awarded', qty: '500', description: 'Laser engrave logo', supplier: '', cost: '1.5', ls: '', os: '', tc: '', uc: '', tcSgd: '', price: '750', up: '1.5', cnTracking:'', sgTracking:'', 
        owner: '', shipper: '', paymentStatus: '', total: '750', manpower: '', lsRmb: '', totalC: '', modeOfPayment: '', orderNumber: '', quantityProduced: '', sample: '', qtyFor: '', paymentAmount: '', difference: '', localOverseas:'Local', numOfCartons:'', paymentRemarks:'',
        timelineRows: makeTimelineRows(), showTimeline: false, showPayments: false,sampleRows:[], showSample: false, sampleOrderStatus:'', sampleStatus:'', sampleType:'',remarks:'',
      },
    ],
  },
];

export const initialEmails: Email[] = [
  {
    id: 'e1', from: 'Mei Lin Yeo', subject: 'RE: Book & Cup Order Confirmation',
    preview: 'Thank you for the samples, we would like to proceed with the full order.',
    body: `Hi,\n\nThank you for sending the samples. We have reviewed them and are happy to proceed with the full order.\n\nPlease prepare the invoice for:\n- 50 pcs Books (NB 2498-II)\n- 50 pcs Cups\n\nKind regards,\nMei Lin Yeo\nBloomsbury Capital Investment`,
    date: '10:30 AM', read: false, clientId: 'c1',
  },
  {
    id: 'e2', from: 'Lara Walsh', subject: 'Canvas Tote Bags - Delivery Update',
    preview: 'Hi, could you please provide us with the tracking number for our order?',
    body: `Hi,\n\nHope you're well. Could you please provide us with the tracking number for the canvas tote bags order (100 pcs)?\n\nWe need to track the delivery for our upcoming event.\n\nBest regards,\nLara Walsh\nBolt Insight Limited`,
    date: 'Yesterday', read: true, clientId: 'c2',
  },
  {
    id: 'e3', from: 'Ahmad Hassan', subject: 'Inquiry: Custom Pen Sets',
    preview: 'We are interested in ordering custom pen sets for our corporate events.',
    body: `Hello,\n\nWe found your company through LinkedIn and are interested in ordering custom pen sets for our corporate events.\n\nWe need approximately 200 units with our company logo on the clip.\n\nCould you please send us a quote?\n\nBest regards,\nAhmad Hassan\nHassan Trading Co.`,
    date: 'Jun 5', read: false, clientId: 'c5',
  },
  {
    id: 'e4', from: 'Jane Lum', subject: 'Notebook Order Invoice',
    preview: 'Please find attached the invoice for the premium notebooks order.',
    body: `Hi,\n\nPlease find attached the invoice for the premium notebooks order:\n- 300 pcs Premium Customisable Notebook w/ Box\n- 150 pcs Premium Customisable Notebook w/ Sleeve\n\nTotal: SGD 6,370\n\nPlease process payment within 30 days.\n\nThank you,\nJane Lum\nShilla Travel Retail Pte Ltd`,
    date: 'Jun 4', read: true, clientId: 'c3',
  },
  {
    id: 'e5', from: 'Sarah Chen', subject: 'Follow Up on Proposal',
    preview: 'Just following up on the proposal we discussed last week for our company event.',
    body: `Dear Team,\n\nI'm following up on the proposal we discussed last week for our company event merchandise.\n\nCould you please update me on the status?\n\nBest regards,\nSarah Chen\nChen & Associates`,
    date: 'Jun 2', read: false, clientId: 'c6',
  },
  {
    id: 'e6', from: 'CN Supplier XYZ', subject: 'Price Update - Q3 2024',
    preview: 'We would like to inform you of upcoming price changes effective July 2024.',
    body: `Dear Partner,\n\nWe would like to inform you of upcoming price adjustments effective July 1, 2024 due to increased raw material costs.\n\nPlease review the updated price list attached.\n\nBest regards,\nSupplier XYZ Team`,
    date: 'Jun 1', read: true,
  },
  {
    id: 'e7', from: 'Marcus Tan', subject: 'AGM Corporate Gifts - Sample Request',
    preview: 'Can we get samples of the leather portfolio before confirming the full order?',
    body: `Hi,\n\nBefore we commit to the full order of 500 pcs for our AGM, could we get 5 samples of the leather portfolio with our logo debossed?\n\nPlease advise on timeline and cost for samples.\n\nThanks,\nMarcus Tan\nTan Brothers Holdings`,
    date: 'May 30', read: false, clientId: 'c7',
  },
];

export const initialNotifications: Notification[] = [
  { id: 'n1', message: 'Lara Walsh payment received — SGD 800', time: '2 hours ago', read: false, type: 'success' },
  { id: 'n2', message: 'Mei Lin Yeo order deadline approaching — Apr 2', time: '5 hours ago', read: false, type: 'warning' },
  { id: 'n3', message: 'New inquiry from Ahmad Hassan (LinkedIn)', time: 'Yesterday', read: true, type: 'info' },
  { id: 'n4', message: 'Jane Lum sample approved — proceed to production', time: '2 days ago', read: true, type: 'success' },
  { id: 'n5', message: 'Marcus Tan sample request pending review', time: '3 days ago', read: false, type: 'warning' },
  { id: 'n6', message: 'Ling Shu Mei local shipping started', time: '4 days ago', read: true, type: 'info' },
];
