-- Create sensor_data table
CREATE TABLE sensor_data (
    id BIGSERIAL PRIMARY KEY,
    temp FLOAT,
    humidity FLOAT,
    soil_moisture FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create disease_logs table
CREATE TABLE disease_logs (
    id BIGSERIAL PRIMARY KEY,
    disease_name TEXT,
    confidence FLOAT,
    treatment TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create spray_logs table
CREATE TABLE spray_logs (
    id BIGSERIAL PRIMARY KEY,
    action TEXT, -- e.g., 'ON', 'OFF'
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Realtime for these tables (optional but recommended for live dashboard)
alter publication supabase_realtime add table sensor_data;
alter publication supabase_realtime add table disease_logs;
alter publication supabase_realtime add table spray_logs;
