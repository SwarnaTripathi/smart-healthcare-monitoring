import numpy as np
import pandas as pd

def construct_deterioration_target(df, horizon_hours=6.0, step_minutes=1.0):
    df = df.sort_values(by=['patientId', 'timestamp']).copy()
    horizon_steps = int((horizon_hours * 60) / step_minutes)
    target_series = []
    for pid, group in df.groupby('patientId'):
        deteriorated_future = (
            group['is_deteriorated']
            .iloc[::-1]
            .rolling(window=horizon_steps, min_periods=1)
            .max()
            .iloc[::-1]
            .shift(-1)
            .fillna(0)
            .astype(int)
        )
        target_series.extend(deteriorated_future.values)
    df['deterioration_within_6h'] = target_series
    return df

def extract_features(df, step_minutes=1.0):
    df = df.sort_values(by=['patientId', 'timestamp']).copy()
    steps_30m = max(1, int(30 / step_minutes))
    steps_1h  = max(1, int(60 / step_minutes))
    steps_3h  = max(1, int(180 / step_minutes))
    feature_dfs = []
    for pid, pdata in df.groupby('patientId'):
        pdf = pdata.copy()
        for col in ['respRate', 'map', 'sysBP', 'etco2']:
            if col not in pdf.columns:
                pdf[col] = np.nan
        pdf['hr_mean_30m']   = pdf['heartRate'].rolling(window=steps_30m, min_periods=1).mean()
        pdf['hr_mean_1h']    = pdf['heartRate'].rolling(window=steps_1h,  min_periods=1).mean()
        pdf['hr_mean_3h']    = pdf['heartRate'].rolling(window=steps_3h,  min_periods=1).mean()
        pdf['spo2_mean_30m'] = pdf['spO2'].rolling(window=steps_30m, min_periods=1).mean()
        pdf['spo2_mean_1h']  = pdf['spO2'].rolling(window=steps_1h,  min_periods=1).mean()
        pdf['spo2_mean_3h']  = pdf['spO2'].rolling(window=steps_3h,  min_periods=1).mean()
        pdf['temp_mean_1h']  = pdf['temperature'].rolling(window=steps_1h, min_periods=1).mean()
        pdf['temp_mean_3h']  = pdf['temperature'].rolling(window=steps_3h, min_periods=1).mean()
        pdf['rr_mean_30m']   = pdf['respRate'].rolling(window=steps_30m, min_periods=1).mean()
        pdf['rr_mean_1h']    = pdf['respRate'].rolling(window=steps_1h,  min_periods=1).mean()
        pdf['map_mean_30m']  = pdf['map'].rolling(window=steps_30m, min_periods=1).mean()
        pdf['map_mean_1h']   = pdf['map'].rolling(window=steps_1h,  min_periods=1).mean()
        pdf['sysbp_mean_1h'] = pdf['sysBP'].rolling(window=steps_1h, min_periods=1).mean()
        pdf['etco2_mean_1h'] = pdf['etco2'].rolling(window=steps_1h, min_periods=1).mean()
        pdf['hr_std_1h']   = pdf['heartRate'].rolling(window=steps_1h,  min_periods=2).std().fillna(0)
        pdf['spo2_std_1h'] = pdf['spO2'].rolling(window=steps_1h,       min_periods=2).std().fillna(0)
        pdf['temp_std_1h'] = pdf['temperature'].rolling(window=steps_1h, min_periods=2).std().fillna(0)
        pdf['rr_std_1h']   = pdf['respRate'].rolling(window=steps_1h,    min_periods=2).std().fillna(0)
        pdf['map_std_1h']  = pdf['map'].rolling(window=steps_1h,         min_periods=2).std().fillna(0)
        pdf['hr_max_1h']    = pdf['heartRate'].rolling(window=steps_1h,  min_periods=1).max()
        pdf['spo2_min_1h']  = pdf['spO2'].rolling(window=steps_1h,       min_periods=1).min()
        pdf['temp_max_1h']  = pdf['temperature'].rolling(window=steps_1h, min_periods=1).max()
        pdf['rr_max_1h']    = pdf['respRate'].rolling(window=steps_1h,    min_periods=1).max()
        pdf['map_min_1h']   = pdf['map'].rolling(window=steps_1h,         min_periods=1).min()
        pdf['sysbp_min_1h'] = pdf['sysBP'].rolling(window=steps_1h,       min_periods=1).min()
        pdf['hr_delta_30m']   = pdf['heartRate']   - pdf['heartRate'].shift(steps_30m).fillna(pdf['heartRate'])
        pdf['hr_delta_1h']    = pdf['heartRate']   - pdf['heartRate'].shift(steps_1h).fillna(pdf['heartRate'])
        pdf['spo2_delta_30m'] = pdf['spO2']        - pdf['spO2'].shift(steps_30m).fillna(pdf['spO2'])
        pdf['spo2_delta_1h']  = pdf['spO2']        - pdf['spO2'].shift(steps_1h).fillna(pdf['spO2'])
        pdf['temp_delta_1h']  = pdf['temperature'] - pdf['temperature'].shift(steps_1h).fillna(pdf['temperature'])
        pdf['rr_delta_30m']   = pdf['respRate']    - pdf['respRate'].shift(steps_30m).fillna(pdf['respRate'])
        pdf['map_delta_30m']  = pdf['map']         - pdf['map'].shift(steps_30m).fillna(pdf['map'])
        pdf['sysbp_delta_1h'] = pdf['sysBP']       - pdf['sysBP'].shift(steps_1h).fillna(pdf['sysBP'])
        pdf['etco2_delta_1h'] = pdf['etco2']       - pdf['etco2'].shift(steps_1h).fillna(pdf['etco2'])
        pdf['hr_spo2_ratio']        = pdf['heartRate'] / (pdf['spO2'] + 1e-5)
        pdf['decompensation_index'] = (pdf['heartRate'] / 75.0) * (98.0 / (pdf['spO2'] + 1e-5)) * (pdf['temperature'] / 37.0)
        pdf['combined_volatility']  = pdf['hr_std_1h'] + (pdf['spo2_std_1h'] * 2.0) + (pdf['temp_std_1h'] * 10.0)
        pdf['resp_distress_idx']    = (pdf['respRate'] * pdf['heartRate']) / (pdf['spO2'] + 1e-5)
        pdf['pulse_pressure_proxy'] = (pdf['sysBP'] - (pdf['map'] * 1.5)).clip(lower=0)
        feature_dfs.append(pdf)
    return pd.concat(feature_dfs, ignore_index=True)

FEATURE_COLUMNS = [
    'heartRate', 'spO2', 'temperature', 'respRate', 'map', 'sysBP', 'etco2',
    'hr_mean_30m', 'hr_mean_1h', 'hr_mean_3h',
    'spo2_mean_30m', 'spo2_mean_1h', 'spo2_mean_3h',
    'temp_mean_1h', 'temp_mean_3h',
    'rr_mean_30m', 'rr_mean_1h',
    'map_mean_30m', 'map_mean_1h',
    'sysbp_mean_1h', 'etco2_mean_1h',
    'hr_std_1h', 'spo2_std_1h', 'temp_std_1h', 'rr_std_1h', 'map_std_1h',
    'hr_max_1h', 'spo2_min_1h', 'temp_max_1h',
    'rr_max_1h', 'map_min_1h', 'sysbp_min_1h',
    'hr_delta_30m', 'hr_delta_1h',
    'spo2_delta_30m', 'spo2_delta_1h',
    'temp_delta_1h',
    'rr_delta_30m', 'map_delta_30m', 'sysbp_delta_1h', 'etco2_delta_1h',
    'hr_spo2_ratio', 'decompensation_index', 'combined_volatility',
    'resp_distress_idx', 'pulse_pressure_proxy'
]
