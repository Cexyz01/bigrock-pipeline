CREATE TABLE mini_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_type TEXT NOT NULL,
  proposer_id UUID NOT NULL REFERENCES profiles(id),
  target_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  game_state JSONB DEFAULT '{}',
  current_turn UUID,
  winner_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mini_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own games" ON mini_games
  FOR SELECT USING (auth.uid() = proposer_id OR auth.uid() = target_id);

CREATE POLICY "Users can insert games" ON mini_games
  FOR INSERT WITH CHECK (auth.uid() = proposer_id);

CREATE POLICY "Players can update their games" ON mini_games
  FOR UPDATE USING (auth.uid() = proposer_id OR auth.uid() = target_id);

ALTER PUBLICATION supabase_realtime ADD TABLE mini_games;
