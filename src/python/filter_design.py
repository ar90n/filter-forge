"""
FilterForge - Filter Design Computation Engine

Supports all approximation functions (Butterworth/Chebyshev I/II/Bessel/Elliptic) x
all filter types (LPF/HPF/BPF/BEF/APF).

Computes:
- Transfer function (numerator, denominator)
- Frequency response (magnitude, phase, group delay)
- Circuit component values (ladder synthesis / lattice topology)
"""

import numpy as np
from scipy import signal
import math
from typing import TypedDict, Literal, Required


# =============================================================================
# Bridge type definitions
# Introspected by scripts/gen_bridge.py to generate TypeScript types.
# =============================================================================

Characteristics = Literal['lpf', 'hpf', 'bpf', 'bef', 'apf']
FilterType = Literal['lc_passive', 'active_sallen_key']
Approximation = Literal['butterworth', 'chebyshev1', 'chebyshev2', 'bessel', 'elliptic']
ComponentType = Literal['resistor', 'capacitor', 'inductor', 'opamp']
ComponentPosition = Literal['series', 'shunt', 'feedback', 'active']
CircuitTopology = Literal['ladder-t', 'ladder-pi', 'lattice', 'sallen-key']


class FilterParams(TypedDict, total=False):
    filterType: Required[FilterType]
    characteristics: Required[Characteristics]
    approximation: Required[Approximation]
    order: Required[int]
    cutoffFrequency: Required[float]
    centerFrequency: float
    bandwidth: float
    passbandRipple: float
    stopbandAttenuation: float
    sourceImpedance: float
    loadImpedance: float
    gain: float


class TransferFunction(TypedDict):
    numerator: list[float]
    denominator: list[float]


class FrequencyResponse(TypedDict):
    frequencies: list[float]
    magnitude: list[float]
    phase: list[float]
    groupDelay: list[float]


class Component(TypedDict):
    id: str
    type: ComponentType
    value: float
    position: ComponentPosition


class FilterResult(TypedDict):
    transferFunction: TransferFunction
    transferFunctionLatex: str
    frequencyResponse: FrequencyResponse
    components: list[Component]
    circuitTopology: CircuitTopology


__bridge_exports__ = ['design_filter']
__bridge_packages__ = ['scipy', 'sympy']


# =============================================================================
# Transfer function computation
# =============================================================================

BTYPE_MAP = {
    "lpf": "lowpass",
    "hpf": "highpass",
    "bpf": "bandpass",
    "bef": "bandstop",
}


def get_transfer_function(approximation, order, Wn, btype, rp=None, rs=None):
    """
    Call the appropriate SciPy filter design function and return the transfer function (b, a).

    Parameters:
        approximation: Approximation function name
        order: Filter order
        Wn: Cutoff angular frequency [rad/s] (BPF/BEF uses [low, high])
        btype: 'lowpass', 'highpass', 'bandpass', 'bandstop'
        rp: passband ripple [dB] (Chebyshev I, Elliptic)
        rs: stopband attenuation [dB] (Chebyshev II, Elliptic)

    Returns:
        (b, a): Numerator and denominator polynomial coefficients of the transfer function
    """
    if approximation == "butterworth":
        return signal.butter(order, Wn, btype=btype, analog=True)
    elif approximation == "chebyshev1":
        return signal.cheby1(order, rp, Wn, btype=btype, analog=True)
    elif approximation == "chebyshev2":
        return signal.cheby2(order, rs, Wn, btype=btype, analog=True)
    elif approximation == "bessel":
        return signal.bessel(order, Wn, btype=btype, analog=True, norm="mag")
    elif approximation == "elliptic":
        return signal.ellip(order, rp, rs, Wn, btype=btype, analog=True)
    else:
        raise ValueError(f"Unknown approximation: {approximation}")


# =============================================================================
# Frequency response computation
# =============================================================================

def compute_frequency_response(b, a, filter_type, cutoff_freq=None,
                                center_freq=None, bandwidth=None):
    """
    Compute frequency response from transfer function (b, a).

    Frequency range is automatically determined based on filter type.
    """
    # Set frequency range
    if filter_type in ("lpf", "hpf"):
        fc = cutoff_freq
        freq_min = fc * 0.01
        freq_max = fc * 100.0
    elif filter_type in ("bpf", "bef"):
        f0 = center_freq
        bw = bandwidth
        freq_min = max(f0 * 0.01, (f0 - bw * 5))
        freq_max = min(f0 * 100.0, (f0 + bw * 5))
        freq_min = max(freq_min, 1.0)  # Minimum 1 Hz
    elif filter_type == "apf":
        f0 = center_freq
        freq_min = f0 * 0.01
        freq_max = f0 * 100.0
    else:
        freq_min = 1.0
        freq_max = 1e6

    frequencies_hz = np.logspace(
        np.log10(freq_min), np.log10(freq_max), num=500
    )
    frequencies_rad = 2.0 * np.pi * frequencies_hz

    w, h = signal.freqs(b, a, worN=frequencies_rad)

    magnitude_db = 20.0 * np.log10(np.abs(h) + 1e-30)
    phase_deg = np.degrees(np.unwrap(np.angle(h)))

    # Compute group delay (numerical differentiation)
    group_delay = compute_group_delay(b, a, frequencies_rad)

    return {
        "frequencies": frequencies_hz.tolist(),
        "magnitude": magnitude_db.tolist(),
        "phase": phase_deg.tolist(),
        "groupDelay": group_delay.tolist(),
    }


def compute_group_delay(b, a, frequencies_rad):
    """
    Compute group delay of an analog filter using numerical differentiation.
    Group delay = -d(phase)/d(omega)
    """
    _, h = signal.freqs(b, a, worN=frequencies_rad)
    phase = np.unwrap(np.angle(h))

    group_delay = np.zeros_like(frequencies_rad)
    if len(frequencies_rad) > 2:
        dw = np.diff(frequencies_rad)
        dphi = np.diff(phase)
        gd = -dphi / dw
        group_delay[:-1] = gd
        group_delay[-1] = gd[-1]

    return group_delay


# =============================================================================
# Transfer function LaTeX formatting
# =============================================================================

def format_transfer_function_latex(b, a):
    """
    Format transfer function (b, a) as LaTeX using SymPy.

    Parameters:
        b: Numerator polynomial coefficients (descending powers of s)
        a: Denominator polynomial coefficients (descending powers of s)

    Returns:
        LaTeX string like "H(s) = \\frac{...}{...}"
    """
    import sympy
    s = sympy.Symbol('s')

    # Convert numpy arrays/scalars to plain Python floats to avoid
    # "ambiguous truth value of array" errors when mixing with SymPy
    b_list = [float(x) for x in b]
    a_list = [float(x) for x in a]

    def build_poly(coeffs):
        degree = len(coeffs) - 1
        max_abs = max(abs(c) for c in coeffs) if coeffs else 1.0
        threshold = max_abs * 1e-15
        expr = sympy.Integer(0)
        for i, c in enumerate(coeffs):
            power = degree - i
            if abs(c) < threshold:
                continue
            expr += sympy.Float(c, 4) * s**power
        return expr if expr != 0 else sympy.Integer(0)

    num_expr = build_poly(b_list)
    den_expr = build_poly(a_list)
    latex_str = sympy.latex(num_expr / den_expr)
    return f"H(s) = {latex_str}"


# =============================================================================
# Normalized element values (g-values) computation
# =============================================================================

def butterworth_g_values(order):
    """Butterworth normalized element values"""
    g = []
    for k in range(1, order + 1):
        g_k = 2.0 * math.sin((2 * k - 1) * math.pi / (2 * order))
        g.append(g_k)
    return g


def chebyshev1_g_values(order, ripple_db):
    """
    Chebyshev Type I normalized element values (Matthaei, Young, Jones formula)
    """
    epsilon = math.sqrt(10.0 ** (ripple_db / 10.0) - 1.0)
    beta = math.asinh(1.0 / epsilon) / order

    g = []
    a_prev = 0.0
    for k in range(1, order + 1):
        a_k = math.sin((2 * k - 1) * math.pi / (2 * order))
        b_k = math.sinh(beta) ** 2 + math.sin(k * math.pi / order) ** 2

        if k == 1:
            g_k = 2.0 * a_k / math.sinh(beta)
        else:
            g_k = 4.0 * a_prev * a_k / (b_prev * g[-1])
        g.append(g_k)
        a_prev = a_k
        b_prev = b_k

    return g


def chebyshev2_g_values(order, attenuation_db):
    """
    Chebyshev Type II (Inverse Chebyshev) normalized element values.
    Compute Chebyshev I g-values and apply frequency inversion.
    """
    # Chebyshev II is derived from Chebyshev I via transformation
    # First compute the equivalent ripple
    ripple_db = 10.0 * math.log10(1.0 + 1.0 / (10.0 ** (attenuation_db / 10.0) - 1.0))
    return chebyshev1_g_values(order, ripple_db)


def bessel_g_values(order):
    """
    Bessel normalized element values (table values from Zverev's tables).
    Supports orders 1 through 10.
    """
    tables = {
        1: [2.0000],
        2: [1.5774, 0.4226],
        3: [1.2550, 0.5528, 0.1922],
        4: [1.0598, 0.5116, 0.3181, 0.1104],
        5: [0.9303, 0.4577, 0.3312, 0.2090, 0.0718],
        6: [0.8377, 0.4116, 0.3158, 0.2364, 0.1480, 0.0505],
        7: [0.7677, 0.3744, 0.2944, 0.2378, 0.1778, 0.1104, 0.0375],
        8: [0.7125, 0.3446, 0.2735, 0.2297, 0.1867, 0.1387, 0.0855, 0.0289],
        9: [0.6678, 0.3203, 0.2547, 0.2184, 0.1859, 0.1506, 0.1111, 0.0682, 0.0230],
        10: [0.6305, 0.3002, 0.2384, 0.2066, 0.1808, 0.1539, 0.1240, 0.0911, 0.0557, 0.0187],
    }
    if order in tables:
        return tables[order]
    # Fallback: use Butterworth
    return butterworth_g_values(order)


def elliptic_g_values(order, ripple_db, attenuation_db):
    """
    Elliptic filter normalized element values.
    Analytical computation is very complex, so a numerical approach is used:
    Design a normalized LPF with SciPy and extract element values via continued fraction expansion.
    """
    return extract_g_values_from_tf(
        "elliptic", order, ripple_db=ripple_db, attenuation_db=attenuation_db
    )


def extract_g_values_from_tf(approximation, order, ripple_db=None, attenuation_db=None):
    """
    Design a normalized LPF prototype with SciPy and extract g-values
    via continued fraction expansion.

    Normalized LPF: Wn=1 rad/s, Z=1 Ohm
    """
    Wn = 1.0  # Normalized cutoff

    rp = ripple_db
    rs = attenuation_db

    b, a = get_transfer_function(approximation, order, Wn, "lowpass", rp=rp, rs=rs)

    # Input impedance Z(s) = 1 / Y(s) from transfer function
    # H(s) = b(s)/a(s) = voltage transfer function
    # For a ladder network terminated in 1Ω, the input impedance is:
    # Z_in(s) = a(s) / a(s) in terms of even/odd parts

    # Approximate extraction of normalized element values: Cauer I form (continued fraction of Z or Y)
    # Z(s) = s*L1 + 1/(s*C2 + 1/(s*L3 + ...))

    # Reconstruct input impedance from transfer function H(s) = b(s)/a(s)
    # Z_in(s) = (even part of a) / (odd part of a) for T-network
    a_poly = np.polynomial.polynomial.Polynomial(a[::-1])  # ascending order

    coeffs = a_poly.coef  # ascending power coefficients

    # Split into even and odd parts
    even_coeffs = np.zeros(len(coeffs))
    odd_coeffs = np.zeros(len(coeffs))
    for i, c in enumerate(coeffs):
        if i % 2 == 0:
            even_coeffs[i] = c
        else:
            odd_coeffs[i] = c

    # Continued fraction expansion by polynomial long division
    g_values = []
    numerator = np.polynomial.polynomial.Polynomial(even_coeffs)
    denominator = np.polynomial.polynomial.Polynomial(odd_coeffs)

    # Alternate between Z = num/den and Y = den/num
    for _ in range(order):
        if denominator.degree() < 0 or all(abs(c) < 1e-15 for c in denominator.coef):
            break

        # Divide numerator by denominator
        quotient, remainder = divmod(numerator, denominator)

        # The leading term of quotient gives the g-value
        q_coeffs = quotient.coef
        if len(q_coeffs) >= 2:
            g_values.append(abs(float(q_coeffs[1])))  # coefficient of s
        elif len(q_coeffs) >= 1:
            g_values.append(abs(float(q_coeffs[0])))
        else:
            break

        numerator = denominator
        denominator = remainder

    # If extraction failed, fall back to Butterworth
    if len(g_values) < order:
        return butterworth_g_values(order)

    return g_values


# =============================================================================
# Component value scaling and frequency transformation
# =============================================================================

def scale_lpf_components(g_values, order, cutoff_freq_hz, impedance):
    """
    Compute LPF ladder circuit component values (T-topology).
    Odd elements: series inductors, even elements: shunt capacitors
    """
    wc = 2.0 * math.pi * cutoff_freq_hz
    components = []
    l_count = 0
    c_count = 0

    for k in range(order):
        g_k = g_values[k]
        if k % 2 == 0:
            l_count += 1
            value = g_k * impedance / wc
            components.append({
                "id": f"L{l_count}",
                "type": "inductor",
                "value": float(value),
                "position": "series"
            })
        else:
            c_count += 1
            value = g_k / (impedance * wc)
            components.append({
                "id": f"C{c_count}",
                "type": "capacitor",
                "value": float(value),
                "position": "shunt"
            })

    return components, "ladder-t"


def scale_hpf_components(g_values, order, cutoff_freq_hz, impedance):
    """
    HPF ladder circuit: inverse transformation of LPF elements.
    Odd elements: series capacitors, even elements: shunt inductors
    """
    wc = 2.0 * math.pi * cutoff_freq_hz
    components = []
    c_count = 0
    l_count = 0

    for k in range(order):
        g_k = g_values[k]
        if k % 2 == 0:
            # LPF series L -> HPF series C
            c_count += 1
            value = 1.0 / (g_k * impedance * wc)
            components.append({
                "id": f"C{c_count}",
                "type": "capacitor",
                "value": float(value),
                "position": "series"
            })
        else:
            # LPF shunt C -> HPF shunt L
            l_count += 1
            value = impedance / (g_k * wc)
            components.append({
                "id": f"L{l_count}",
                "type": "inductor",
                "value": float(value),
                "position": "shunt"
            })

    return components, "ladder-t"


def scale_bpf_components(g_values, order, center_freq_hz, bandwidth_hz, impedance):
    """
    BPF ladder circuit: bandpass transformation of LPF prototype.
    Series L -> series LC (series resonator)
    Shunt C -> shunt LC (parallel resonator)
    """
    w0 = 2.0 * math.pi * center_freq_hz
    bw = 2.0 * math.pi * bandwidth_hz
    components = []
    l_count = 0
    c_count = 0

    for k in range(order):
        g_k = g_values[k]
        if k % 2 == 0:
            # Series L -> series L + series C (series resonator)
            l_count += 1
            c_count += 1
            L_val = g_k * impedance / bw
            C_val = bw / (g_k * impedance * w0 * w0)
            components.append({
                "id": f"L{l_count}",
                "type": "inductor",
                "value": float(L_val),
                "position": "series"
            })
            components.append({
                "id": f"C{c_count}",
                "type": "capacitor",
                "value": float(C_val),
                "position": "series"
            })
        else:
            # Shunt C -> shunt L + shunt C (parallel resonator)
            l_count += 1
            c_count += 1
            C_val = g_k / (impedance * bw)
            L_val = impedance * bw / (g_k * w0 * w0)
            components.append({
                "id": f"L{l_count}",
                "type": "inductor",
                "value": float(L_val),
                "position": "shunt"
            })
            components.append({
                "id": f"C{c_count}",
                "type": "capacitor",
                "value": float(C_val),
                "position": "shunt"
            })

    return components, "ladder-t"


def scale_bef_components(g_values, order, center_freq_hz, bandwidth_hz, impedance):
    """
    BEF ladder circuit: band-elimination transformation of LPF prototype.
    Series L -> parallel LC (parallel resonator in series path)
    Shunt C -> series LC (series resonator in shunt path)
    """
    w0 = 2.0 * math.pi * center_freq_hz
    bw = 2.0 * math.pi * bandwidth_hz
    components = []
    l_count = 0
    c_count = 0

    for k in range(order):
        g_k = g_values[k]
        if k % 2 == 0:
            # Series L -> parallel LC in series path (trap)
            l_count += 1
            c_count += 1
            C_val = bw / (g_k * impedance * w0 * w0)
            L_val = g_k * impedance / bw
            # These form a parallel resonator placed in the series path
            components.append({
                "id": f"L{l_count}",
                "type": "inductor",
                "value": float(L_val),
                "position": "series"
            })
            components.append({
                "id": f"C{c_count}",
                "type": "capacitor",
                "value": float(C_val),
                "position": "series"
            })
        else:
            # Shunt C -> series LC in shunt path (trap)
            l_count += 1
            c_count += 1
            L_val = impedance * bw / (g_k * w0 * w0)
            C_val = g_k / (impedance * bw)
            components.append({
                "id": f"L{l_count}",
                "type": "inductor",
                "value": float(L_val),
                "position": "shunt"
            })
            components.append({
                "id": f"C{c_count}",
                "type": "capacitor",
                "value": float(C_val),
                "position": "shunt"
            })

    return components, "ladder-t"


def design_apf_components(order, center_freq_hz, impedance):
    """
    Design a lattice-type circuit for APF (All-Pass Filter).

    1st-order APF: lattice configuration with L and C combination
    Higher order: cascade of 1st-order sections
    """
    w0 = 2.0 * math.pi * center_freq_hz
    components = []
    l_count = 0
    c_count = 0

    for k in range(order):
        # Each section: lattice series arm and lattice arm
        l_count += 1
        c_count += 1
        L_val = impedance / w0
        C_val = 1.0 / (impedance * w0)
        components.append({
            "id": f"L{l_count}",
            "type": "inductor",
            "value": float(L_val),
            "position": "series"
        })
        components.append({
            "id": f"C{c_count}",
            "type": "capacitor",
            "value": float(C_val),
            "position": "shunt"
        })

    return components, "lattice"


def design_apf_transfer_function(order, center_freq_hz):
    """
    Construct the APF transfer function.
    H(s) = (-s + w0) / (s + w0) for 1st order
    Higher order: product of 1st-order sections
    """
    w0 = 2.0 * math.pi * center_freq_hz

    # 1st-order APF: H(s) = (-s + w0) / (s + w0)
    # Higher order: cascade
    b = np.array([1.0])
    a = np.array([1.0])

    for _ in range(order):
        # Each section: (-s + w0) / (s + w0)
        b_section = np.array([-1.0, w0])
        a_section = np.array([1.0, w0])
        b = np.polymul(b, b_section)
        a = np.polymul(a, a_section)

    return b, a


# =============================================================================
# g-values dispatch
# =============================================================================

def get_g_values(approximation, order, ripple_db=None, attenuation_db=None):
    """Return g-values for the given approximation function"""
    if approximation == "butterworth":
        return butterworth_g_values(order)
    elif approximation == "chebyshev1":
        return chebyshev1_g_values(order, ripple_db)
    elif approximation == "chebyshev2":
        return chebyshev2_g_values(order, attenuation_db)
    elif approximation == "bessel":
        return bessel_g_values(order)
    elif approximation == "elliptic":
        return elliptic_g_values(order, ripple_db, attenuation_db)
    else:
        return butterworth_g_values(order)


# =============================================================================
# Main entry point
# =============================================================================

def design_filter(params: FilterParams) -> FilterResult:
    """
    Main entry point for filter design.

    Parameters:
        params: dict with keys:
            - filterType: 'lc_passive' | 'active_sallen_key'
            - characteristics: 'lpf' | 'hpf' | 'bpf' | 'bef' | 'apf'
            - approximation: 'butterworth' | 'chebyshev1' | 'chebyshev2' | 'bessel' | 'elliptic'
            - order: int (1-10)
            - cutoffFrequency: float [Hz] (LPF/HPF)
            - centerFrequency: float [Hz] (BPF/BEF/APF)
            - bandwidth: float [Hz] (BPF/BEF)
            - passbandRipple: float [dB] (Chebyshev I, Elliptic)
            - stopbandAttenuation: float [dB] (Chebyshev II, Elliptic)
            - sourceImpedance: float [Ohm] (LC Passive only)
            - loadImpedance: float [Ohm] (LC Passive only)
            - gain: float (Sallen-Key, default 1.0)

    Returns:
        dict: FilterResult
    """
    try:
        filter_type = params.get("filterType", "lc_passive")
        characteristics = params.get("characteristics", "lpf")
        approximation = params.get("approximation", "butterworth")
        order = int(params.get("order", 3))
        cutoff_freq = float(params.get("cutoffFrequency", 0))
        center_freq = float(params.get("centerFrequency", 0))
        bandwidth = float(params.get("bandwidth", 0))
        ripple_db = params.get("passbandRipple")
        attenuation_db = params.get("stopbandAttenuation")

        if ripple_db is not None:
            ripple_db = float(ripple_db)
        if attenuation_db is not None:
            attenuation_db = float(attenuation_db)

        # --- Dispatch by filter type ---
        if filter_type == "active_sallen_key":
            return design_sallen_key_filter(
                characteristics, approximation, order,
                cutoff_freq, center_freq, bandwidth,
                ripple_db, attenuation_db,
                gain=float(params.get("gain", 1.0)),
            )

        # --- LC Passive filter ---
        source_impedance = float(params.get("sourceImpedance", 50.0))
        load_impedance = float(params.get("loadImpedance", 50.0))

        # --- Validation ---
        if order < 1 or order > 10:
            return _error("INVALID_PARAMS", "Filter order must be between 1 and 10.")

        if source_impedance <= 0 or load_impedance <= 0:
            return _error("INVALID_PARAMS", "Impedance must be positive.")

        if characteristics in ("lpf", "hpf"):
            if cutoff_freq <= 0:
                return _error("INVALID_PARAMS", "Cutoff frequency must be positive.")
        elif characteristics in ("bpf", "bef"):
            if center_freq <= 0:
                return _error("INVALID_PARAMS", "Center frequency must be positive.")
            if bandwidth <= 0:
                return _error("INVALID_PARAMS", "Bandwidth must be positive.")
        elif characteristics == "apf":
            if center_freq <= 0:
                return _error("INVALID_PARAMS", "Center frequency must be positive.")
        else:
            return _error("INVALID_PARAMS", f"Unknown characteristics: {characteristics}")

        valid_approximations = ["butterworth", "chebyshev1", "chebyshev2", "bessel", "elliptic"]
        if characteristics != "apf" and approximation not in valid_approximations:
            return _error("INVALID_PARAMS", f"Unknown approximation: {approximation}")

        if approximation in ("chebyshev1", "elliptic") and characteristics != "apf":
            if ripple_db is None or ripple_db <= 0:
                return _error("INVALID_PARAMS", "Passband ripple must be positive.")

        if approximation in ("chebyshev2", "elliptic") and characteristics != "apf":
            if attenuation_db is None or attenuation_db <= 0:
                return _error("INVALID_PARAMS", "Stopband attenuation must be positive.")

        impedance = source_impedance

        # --- APF: special handling ---
        if characteristics == "apf":
            b, a = design_apf_transfer_function(order, center_freq)
            freq_resp = compute_frequency_response(b, a, "apf",
                                                    center_freq=center_freq)
            components, topology = design_apf_components(order, center_freq, impedance)
            latex = format_transfer_function_latex(b, a)

            return {
                "transferFunction": {
                    "numerator": b.tolist(),
                    "denominator": a.tolist(),
                },
                "transferFunctionLatex": latex,
                "frequencyResponse": freq_resp,
                "components": components,
                "circuitTopology": topology,
            }

        # --- LPF/HPF/BPF/BEF ---
        btype = BTYPE_MAP[characteristics]

        # Compute Wn
        if characteristics in ("lpf", "hpf"):
            Wn = 2.0 * math.pi * cutoff_freq
        else:  # bpf, bef
            f_low = center_freq - bandwidth / 2.0
            f_high = center_freq + bandwidth / 2.0
            if f_low <= 0:
                f_low = 1.0  # Minimum 1 Hz
            Wn = [2.0 * math.pi * f_low, 2.0 * math.pi * f_high]

        # Compute transfer function
        b, a = get_transfer_function(
            approximation, order, Wn, btype,
            rp=ripple_db, rs=attenuation_db
        )

        # Frequency response
        freq_resp = compute_frequency_response(
            b, a, characteristics,
            cutoff_freq=cutoff_freq,
            center_freq=center_freq,
            bandwidth=bandwidth
        )

        # Compute component values
        g_values = get_g_values(
            approximation, order,
            ripple_db=ripple_db,
            attenuation_db=attenuation_db
        )

        if characteristics == "lpf":
            components, topology = scale_lpf_components(
                g_values, order, cutoff_freq, impedance
            )
        elif characteristics == "hpf":
            components, topology = scale_hpf_components(
                g_values, order, cutoff_freq, impedance
            )
        elif characteristics == "bpf":
            components, topology = scale_bpf_components(
                g_values, order, center_freq, bandwidth, impedance
            )
        elif characteristics == "bef":
            components, topology = scale_bef_components(
                g_values, order, center_freq, bandwidth, impedance
            )

        latex = format_transfer_function_latex(b, a)

        return {
            "transferFunction": {
                "numerator": b.tolist(),
                "denominator": a.tolist(),
            },
            "transferFunctionLatex": latex,
            "frequencyResponse": freq_resp,
            "components": components,
            "circuitTopology": topology,
        }

    except Exception as e:
        return {
            "error": {
                "code": "CALCULATION_ERROR",
                "message": str(e),
                "details": repr(e),
            }
        }


# =============================================================================
# Sallen-Key active filter design
# =============================================================================

SALLEN_KEY_SUPPORTED = ("lpf", "hpf", "bpf")
DEFAULT_R_REF = 10000.0  # 10 kΩ reference resistance


def design_sallen_key_lpf_stage(w0, Q, R_ref):
    """
    Design a single Sallen-Key LPF 2nd-order stage (equal-R topology).

    Unity-gain Sallen-Key LPF (Wikipedia convention):
        In ──[R1]──┬──[R2]──┬──(+)OpAmp── Out
                   │        │              │
                   └──[C1]─────────────────┘  (C1 = feedback: junction1 → output)
                            │
                           [C2]               (C2 = ground:   junction2 → GND)
                            │
                           GND

    Equal-R design: R1 = R2 = R_ref
        C1 = 2Q / (w0 * R)   (feedback capacitor, larger value)
        C2 = 1 / (2Q * w0 * R)  (grounded capacitor, smaller value)
    """
    R = R_ref
    C1 = 2.0 * Q / (w0 * R)
    C2 = 1.0 / (2.0 * Q * w0 * R)
    return R, R, C1, C2


def design_sallen_key_hpf_stage(w0, Q, R_ref):
    """
    Design a single Sallen-Key HPF 2nd-order stage (equal-C topology).

    Unity-gain Sallen-Key HPF (Wikipedia convention):
        In ──[C1]──┬──[C2]──┬──(+)OpAmp── Out
                   │        │              │
                   └──[R1]─────────────────┘  (R1 = feedback: junction1 → output)
                            │
                           [R2]               (R2 = ground:   junction2 → GND)
                            │
                           GND

    Equal-C design: C1 = C2 = C_ref = 1 / (w0 * R_ref)
        R1 = 1 / (2Q * w0 * C)  (feedback resistor)
        R2 = 2Q / (w0 * C)      (grounded resistor)
    """
    C = 1.0 / (w0 * R_ref)
    R1 = 1.0 / (2.0 * Q * w0 * C)
    R2 = 2.0 * Q / (w0 * C)
    return R1, R2, C, C


def design_sallen_key_bpf_stage(w0, Q, R_ref):
    """
    Design a single Multiple Feedback (MFB) BPF 2nd-order stage.

    MFB BPF topology (commonly paired with Sallen-Key for bandpass):
        In ──[R1]──┬──[C1]──┬──[OpAmp(-)]── Out
                   │        │       │
                  [R2]     [C2]─────┘ (feedback)
                   │
                  GND

    Design equations (unity gain at center frequency):
        C1 = C2 = C = 1 / (w0 * R_ref)
        R1 = Q / (w0 * C)
        R2 = Q / (2 * Q^2 - 1) / (w0 * C)  (for gain = 1 at center)
        R3 = 2 * Q / (w0 * C)
    """
    C = 1.0 / (w0 * R_ref)
    R1 = Q / (w0 * C)
    denom = 2.0 * Q * Q
    if denom < 1.0:
        denom = 1.0  # Prevent negative or zero R2 for low Q
    R2 = Q / (denom * w0 * C)
    R3 = 2.0 * Q / (w0 * C)
    return R1, R2, R3, C, C


def design_sallen_key_filter(characteristics, approximation, order,
                              cutoff_freq, center_freq, bandwidth,
                              ripple_db, attenuation_db, gain=1.0):
    """
    Design an active Sallen-Key filter by cascading 2nd-order sections.

    Constraints:
      - Even order only (2, 4, 6, 8, 10)
      - Characteristics: LPF, HPF, or BPF
    """
    # --- Validation ---
    if characteristics not in SALLEN_KEY_SUPPORTED:
        return _error("INVALID_PARAMS",
                       f"Sallen-Key does not support '{characteristics}'. Use LPF, HPF, or BPF.")

    if order < 2 or order > 10:
        return _error("INVALID_PARAMS", "Filter order must be between 2 and 10.")

    if order % 2 != 0:
        return _error("INVALID_PARAMS", "Sallen-Key requires an even order (2, 4, 6, 8, 10).")

    valid_approximations = ["butterworth", "chebyshev1", "chebyshev2", "bessel", "elliptic"]
    if approximation not in valid_approximations:
        return _error("INVALID_PARAMS", f"Unknown approximation: {approximation}")

    if characteristics in ("lpf", "hpf"):
        if cutoff_freq <= 0:
            return _error("INVALID_PARAMS", "Cutoff frequency must be positive.")
    elif characteristics == "bpf":
        if center_freq <= 0:
            return _error("INVALID_PARAMS", "Center frequency must be positive.")
        if bandwidth <= 0:
            return _error("INVALID_PARAMS", "Bandwidth must be positive.")

    if approximation in ("chebyshev1", "elliptic"):
        if ripple_db is None or ripple_db <= 0:
            return _error("INVALID_PARAMS", "Passband ripple must be positive.")

    if approximation in ("chebyshev2", "elliptic"):
        if attenuation_db is None or attenuation_db <= 0:
            return _error("INVALID_PARAMS", "Stopband attenuation must be positive.")

    # --- Compute transfer function ---
    btype = BTYPE_MAP[characteristics]

    if characteristics in ("lpf", "hpf"):
        Wn = 2.0 * math.pi * cutoff_freq
    else:  # bpf
        f_low = center_freq - bandwidth / 2.0
        f_high = center_freq + bandwidth / 2.0
        if f_low <= 0:
            f_low = 1.0
        Wn = [2.0 * math.pi * f_low, 2.0 * math.pi * f_high]

    b, a = get_transfer_function(
        approximation, order, Wn, btype,
        rp=ripple_db, rs=attenuation_db
    )

    # --- Frequency response ---
    freq_resp = compute_frequency_response(
        b, a, characteristics,
        cutoff_freq=cutoff_freq,
        center_freq=center_freq,
        bandwidth=bandwidth
    )

    # --- Decompose into 2nd-order sections ---
    z, p, k = signal.tf2zpk(b, a)
    sos = signal.zpk2sos(z, p, k, pairing='nearest')

    # --- Design component values for each stage ---
    components = []
    num_stages = len(sos)

    for stage_idx in range(num_stages):
        stage_num = stage_idx + 1
        # Each SOS row: [b0, b1, b2, a0, a1, a2]
        # For analog: a0*s^2 + a1*s + a2  (but SOS from zpk2sos is digital-style)
        # We need w0 and Q from the denominator polynomial of each section
        sos_row = sos[stage_idx]
        a0_s, a1_s, a2_s = sos_row[3], sos_row[4], sos_row[5]

        # w0 = sqrt(a2/a0), Q = sqrt(a0*a2) / a1
        if a0_s == 0 or a2_s == 0:
            # Degenerate section, skip
            continue

        w0 = math.sqrt(abs(a2_s / a0_s))
        if a1_s == 0:
            Q = 100.0  # Very high Q (near-oscillatory)
        else:
            Q = math.sqrt(abs(a0_s * a2_s)) / abs(a1_s)

        Q = max(Q, 0.1)  # Clamp minimum Q
        Q = min(Q, 100.0)  # Clamp maximum Q

        if characteristics == "lpf":
            R1, R2, C1, C2 = design_sallen_key_lpf_stage(w0, Q, DEFAULT_R_REF)
            components.extend([
                {"id": f"S{stage_num}_R1", "type": "resistor", "value": float(R1), "position": "series"},
                {"id": f"S{stage_num}_R2", "type": "resistor", "value": float(R2), "position": "series"},
                {"id": f"S{stage_num}_C1", "type": "capacitor", "value": float(C1), "position": "feedback"},
                {"id": f"S{stage_num}_C2", "type": "capacitor", "value": float(C2), "position": "shunt"},
                {"id": f"S{stage_num}_U", "type": "opamp", "value": 0, "position": "active"},
            ])
        elif characteristics == "hpf":
            R1, R2, C1, C2 = design_sallen_key_hpf_stage(w0, Q, DEFAULT_R_REF)
            components.extend([
                {"id": f"S{stage_num}_C1", "type": "capacitor", "value": float(C1), "position": "series"},
                {"id": f"S{stage_num}_C2", "type": "capacitor", "value": float(C2), "position": "series"},
                {"id": f"S{stage_num}_R1", "type": "resistor", "value": float(R1), "position": "feedback"},
                {"id": f"S{stage_num}_R2", "type": "resistor", "value": float(R2), "position": "shunt"},
                {"id": f"S{stage_num}_U", "type": "opamp", "value": 0, "position": "active"},
            ])
        elif characteristics == "bpf":
            R1, R2, R3, C1, C2 = design_sallen_key_bpf_stage(w0, Q, DEFAULT_R_REF)
            components.extend([
                {"id": f"S{stage_num}_R1", "type": "resistor", "value": float(R1), "position": "series"},
                {"id": f"S{stage_num}_R2", "type": "resistor", "value": float(R2), "position": "shunt"},
                {"id": f"S{stage_num}_R3", "type": "resistor", "value": float(R3), "position": "series"},
                {"id": f"S{stage_num}_C1", "type": "capacitor", "value": float(C1), "position": "series"},
                {"id": f"S{stage_num}_C2", "type": "capacitor", "value": float(C2), "position": "feedback"},
                {"id": f"S{stage_num}_U", "type": "opamp", "value": 0, "position": "active"},
            ])

    latex = format_transfer_function_latex(b, a)

    return {
        "transferFunction": {
            "numerator": b.tolist(),
            "denominator": a.tolist(),
        },
        "transferFunctionLatex": latex,
        "frequencyResponse": freq_resp,
        "components": components,
        "circuitTopology": "sallen-key",
    }


def _error(code, message):
    """Helper for error responses"""
    return {
        "error": {
            "code": code,
            "message": message,
        }
    }
