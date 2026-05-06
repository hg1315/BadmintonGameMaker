import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { PersistedState } from "@/lib/persistence/types";

const DEFAULT_STATE_KEY = "default";

export async function GET() {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase
    .from("app_states")
    .select("payload, updated_at")
    .eq("state_key", DEFAULT_STATE_KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ payload: data?.payload ?? null, updatedAt: data?.updated_at ?? null });
}

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json(
      { message: "Supabase 환경변수가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { payload?: PersistedState };

  if (!body.payload) {
    return NextResponse.json({ message: "저장할 payload가 없습니다." }, { status: 400 });
  }

  const { error } = await supabase.from("app_states").upsert(
    {
      state_key: DEFAULT_STATE_KEY,
      payload: body.payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "state_key" },
  );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
