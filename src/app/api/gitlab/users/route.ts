import { NextRequest, NextResponse } from 'next/server';
import { fetchUsers } from '@/lib/gitlab';

export async function GET(request: NextRequest) {
  try {
    const users = await fetchUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching GitLab users:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
