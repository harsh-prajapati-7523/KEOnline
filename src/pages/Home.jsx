import { Phone, MapPin, Mail, CheckCircle } from "lucide-react";

export default function App() {

    const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();
    console.log("Saved:", data);

    alert("Ticket Raised Successfully!");

    // optional: reset form
    setFormData({
      customerName: "",
      mobileNo: "",
      equipmentName: "",
      issue: "",
      address: "",
      priority: "Medium",
      serviceDate: "",
      description: "",
    });

  } catch (error) {
    console.error("Error:", error);
    alert("Failed to raise ticket");
  }
};
    return (
        <div className="min-h-screen bg-white text-gray-800 overflow-x-hidden">

            {/* Hero Section */}
            <section className="bg-gradient-to-r from-blue-950 to-blue-800 text-white py-12 md:py-16 px-4">

                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

                    {/* Left */}
                    <div className="text-center lg:text-left">

                        <h2 className="text-3xl md:text-5xl font-extrabold leading-tight">
                            Reliable Power
                            <br />

                            <span className="text-yellow-400">
                                Uninterrupted Life
                            </span>
                        </h2>

                        <p className="mt-5 text-base md:text-lg text-gray-200 leading-relaxed">
                            Battery, Inverter, Solar, UPS & Stabilizer
                            solutions with expert installation and fast service.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center lg:justify-start">

                            <button className="bg-yellow-400 hover:bg-yellow-300 text-black px-6 py-3 rounded-xl font-bold shadow-lg">
                                Contact Us
                            </button>

                            <button className="border border-white hover:bg-white hover:text-black px-6 py-3 rounded-xl font-bold">
                                Services
                            </button>

                        </div>
                    </div>

                    {/* Right */}
                    <div className="bg-white rounded-3xl p-5 md:p-8 shadow-2xl">

                        <div className="grid grid-cols-2 gap-4">

                            {[
                                "Battery",
                                "Inverter",
                                "Solar",
                                "UPS",
                                "Home Power",
                                "Stabilizer",
                            ].map((item) => (
                                <div
                                    key={item}
                                    className="border-2 border-blue-100 rounded-2xl p-4 text-center hover:shadow-xl transition"
                                >
                                    <div className="text-3xl md:text-4xl mb-2">⚡</div>

                                    <h3 className="font-bold text-sm md:text-lg text-blue-950">
                                        {item}
                                    </h3>
                                </div>
                            ))}

                        </div>
                    </div>
                </div>
            </section>

            {/* Contact + Features */}
            <section className="py-12 md:py-14 px-4 bg-gray-50">

                <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">

                    {/* Contact */}
                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-lg">

                        <h2 className="text-2xl md:text-3xl font-bold text-blue-950 mb-6">
                            Contact Information
                        </h2>

                        <div className="space-y-5">

                            <div className="flex gap-4 items-start">
                                <Phone className="text-yellow-500 flex-shrink-0" />

                                <p className="font-semibold text-base md:text-lg">
                                    +91-9935481362
                                </p>
                            </div>

                            <div className="flex gap-4 items-start">
                                <MapPin className="text-yellow-500 flex-shrink-0" />

                                <p className="text-sm md:text-base">
                                    Near Vetnary Hospital, NH28,
                                    Sahjanwa, Gorakhpur (U.P.) 273209
                                </p>
                            </div>

                            <div className="flex gap-4 items-start">
                                <Mail className="text-yellow-500 flex-shrink-0" />

                                <p className="text-sm md:text-base break-all">
                                    kumarelectronic1977@gmail.com
                                </p>
                            </div>

                        </div>
                    </div>

                    {/* Features */}
                    <div className="bg-blue-950 text-white p-6 md:p-8 rounded-3xl shadow-lg">

                        <h2 className="text-2xl md:text-3xl font-bold mb-6">
                            Why Choose Us
                        </h2>

                        <div className="space-y-5">

                            {[
                                "Reliable Products",
                                "Expert Installation",
                                "Fast Service",
                                "Customer Satisfaction",
                            ].map((feature) => (
                                <div
                                    key={feature}
                                    className="flex items-center gap-4"
                                >
                                    <CheckCircle className="text-yellow-400 flex-shrink-0" />

                                    <p className="text-base md:text-lg">
                                        {feature}
                                    </p>
                                </div>
                            ))}

                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-blue-950 text-center text-white py-5 px-4">

                <p className="font-semibold text-sm md:text-base">
                    © 2026 Kumar Electronics & Electricals
                </p>

            </footer>
        </div>
    );
}