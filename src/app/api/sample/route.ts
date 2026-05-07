import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const sampleData = [
    {
      type: 'Hardware',
      Category: 'Laptop',
      Requestor: 'John Doe',
      'Computer Name': 'LT-JDOE-001',
      Department: 'IT',
      Location: 'Head Office',
      Project: 'General',
      Description: 'Need new laptop for development work - current laptop is 5 years old',
      Priority: 'Medium',
      Assign: 'IT Support',
    },
    {
      type: 'Software',
      Category: 'Microsoft Office',
      Requestor: 'Jane Smith',
      'Computer Name': 'PC-JSMITH-042',
      Department: 'HR',
      Location: 'Head Office',
      Project: 'General',
      Description: 'Request for Microsoft Office 365 license',
      Priority: 'Low',
      Assign: 'IT Support',
    },
    {
      type: 'Hardware',
      Category: 'Monitor',
      Requestor: 'Bob Johnson',
      'Computer Name': 'LT-BJOHNSON-007',
      Department: 'Finance',
      Location: 'Branch A',
      Project: 'Budget 2024',
      Description: 'Need additional monitor for remote work setup',
      Priority: 'High',
      Assign: 'IT Support',
    },
  ];

  const headers = [
    'type', 'Category', 'Requestor', 'Computer Name',
    'Department', 'Location', 'Project', 'Description',
    'Priority', 'Assign'
  ];

  const csvContent = [
    headers.join(','),
    ...sampleData.map(row => [
      row.type,
      row.Category,
      row.Requestor,
      row['Computer Name'],
      row.Department,
      row.Location,
      row.Project,
      `"${row.Description}"`, // Quote description as it may contain commas
      row.Priority,
      row.Assign,
    ].join(','))
  ].join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="sample_helpdesk_tickets.csv"',
    },
  });
}
