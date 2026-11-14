import json

UA_A_KM = 149597870.7
VELOCIDAD_LUZ_KM_S = 299792.458

def leer_tabla_horizons(ruta_archivo):
    """Extrae las filas entre $$SOE y $$EOE de un archivo de NASA Horizons."""
    datos = {}
    leyendo = False
    with open(ruta_archivo, "r", encoding="utf-8") as f:
        for linea in f:
            if "$$SOE" in linea:
                leyendo = True
                continue
            if "$$EOE" in linea:
                break
            if leyendo and linea.strip():
                partes = linea.split()
                fecha_hora = f"{partes[0]} {partes[1]}"
                
                # Detectar banderas (* = luz solar, i = Tierra sobre el horizonte)
                idx_num = 2
                banderas = ""
                if not partes[2].replace('.', '', 1).replace('-', '', 1).isdigit():
                    banderas = partes[2]
                    idx_num = 3
                
                valores = [float(x) for x in partes[idx_num:]]
                datos[fecha_hora] = {
                    "banderas": banderas,
                    "valores": valores
                }
    return datos

# Leer ambos archivos de Shackleton Rim
sol_data = leer_tabla_horizons("shackleton_sol.txt")
tierra_data = leer_tabla_horizons("shackleton_tierra.txt")

cronograma = []
dias_con_luz = 0
dias_con_senal = 0

for fecha, info_sol in sol_data.items():
    if fecha not in tierra_data:
        continue
        
    # Columnas Sol: [0]=Azi, [1]=Elev
    az_sol, el_sol = info_sol["valores"][0], info_sol["valores"][1]
    
    # Columnas Tierra: [0]=Azi, [1]=Elev, [2]=delta(AU), [3]=deldot, [4]=S-T-O(fase)
    vals_t = tierra_data[fecha]["valores"]
    az_tierra = vals_t[0]
    el_tierra = vals_t[1]
    distancia_km = round(vals_t[2] * UA_A_KM, 1)
    angulo_fase = vals_t[4]
    
    # Evaluación de visibilidad (superando relieve local de ~1.0° en borde de cráter)
    hay_luz = ("*" in info_sol["banderas"]) and (el_sol > 1.0)
    hay_senal = ("i" in tierra_data[fecha]["banderas"]) and (el_tierra > 1.0)
    
    if hay_luz:
        dias_con_luz += 1
    if hay_senal:
        dias_con_senal += 1
        
    latencia_seg = round(distancia_km / VELOCIDAD_LUZ_KM_S, 3)

    cronograma.append({
        "fecha_hora": fecha,
        "sol": {
            "elevacion": round(el_sol, 2),
            "azimut": round(az_sol, 2),
            "estado_luz_solar": hay_luz
        },
        "tierra": {
            "elevacion": round(el_tierra, 2),
            "azimut": round(az_tierra, 2),
            "linea_vista_directa": hay_senal,
            "distancia_km": distancia_km,
            "latencia_comunicaciones_seg": latencia_seg,
            "angulo_fase": round(angulo_fase, 2)
        }
    })

total = len(cronograma)
salida = {
    "mision": "Artemis III - Polo Sur Lunar",
    "sitios": [
        {
            "id": "shackleton_rim",
            "nombre": "Borde del Crater Shackleton",
            "coordenadas": {"latitud": -89.66, "longitud": 129.2, "altitud_km": 1.2},
            "resumen": {
                "porcentaje_luz_solar": round((dias_con_luz / total) * 100, 1),
                "porcentaje_linea_vista_tierra": round((dias_con_senal / total) * 100, 1)
            },
            "cronograma": cronograma
        }
    ]
}

with open("sites_data.json", "w", encoding="utf-8") as f:
    json.dump(salida, f, indent=2, ensure_ascii=False)

print(f"Listo: {total} dias procesados en sites_data.json")