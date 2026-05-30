import { useState } from "react";
import BASE_URL from "../services/config";
import {
    User,
    Phone,
    Wrench,
    AlertTriangle,
    Calendar,
    FileText,
    MapPin,
    Send,
} from "lucide-react";

export default function RiseTicket() {
    const [formData, setFormData] = useState({
        customerName: "",
        mobileNo: "",
        equipmentName: "",
        issue: "",
        address: "",
        priority: "Medium",
        serviceDate: "",
        description: "",
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
    e.preventDefault();

    try {
        const response = await fetch(`${BASE_URL}/tickets/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
        });

        if (!response.ok) {
            throw new Error("Failed to save ticket");
        }

        const data = await response.json();
        console.log("Saved Ticket:", data);

        alert("Ticket Raised Successfully!");

        // reset form after success
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
        console.error(error);
        alert("Error while raising ticket");
    }
};

    return (
        <div className="min-h-screen bg-gray-100 py-6 md:py-10 px-3 md:px-4">

            <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">

                {/* Header */}
                <div className="bg-blue-950 text-white px-5 py-6 md:p-8">

                    <h1 className="text-2xl md:text-4xl font-extrabold text-center md:text-left">
                        Raise Service Ticket
                    </h1>

                    <p className="mt-2 text-gray-300 text-sm md:text-base text-center md:text-left">
                        Kumar Electronics & Electricals
                    </p>

                </div>

                {/* Form */}
                <form
                    onSubmit={handleSubmit}
                    className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6"
                >

                    {/* Customer Name */}
                    <div>
                        <label className="font-semibold mb-2 block text-sm md:text-base">
                            Customer Name
                        </label>

                        <div className="flex items-center border rounded-xl px-4 py-3">

                            <User className="text-blue-950 mr-3 flex-shrink-0" size={20} />

                            <input
                                type="text"
                                name="customerName"
                                placeholder="Enter customer name"
                                value={formData.customerName}
                                onChange={handleChange}
                                className="w-full outline-none text-sm md:text-base"
                                required
                            />

                        </div>
                    </div>

                    {/* Mobile Number */}
                    <div>
                        <label className="font-semibold mb-2 block text-sm md:text-base">
                            Mobile Number
                        </label>

                        <div className="flex items-center border rounded-xl px-4 py-3">

                            <Phone className="text-blue-950 mr-3 flex-shrink-0" size={20} />

                            <input
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]{10}"
                                maxLength={10}
                                name="mobileNo"
                                placeholder="Enter mobile number"
                                value={formData.mobileNo}
                                onChange={handleChange}
                                className="w-full outline-none text-sm md:text-base"
                                required
                            />

                        </div>
                    </div>

                    {/* Equipment */}
                    <div>
                        <label className="font-semibold mb-2 block text-sm md:text-base">
                            Equipment Name
                        </label>

                        <div className="flex items-center border rounded-xl px-4 py-3">

                            <Wrench className="text-blue-950 mr-3 flex-shrink-0" size={20} />

                            <select
                                name="equipmentName"
                                value={formData.equipmentName}
                                onChange={handleChange}
                                className="w-full outline-none text-sm md:text-base bg-transparent"
                                required
                            >
                                <option value="">Select Equipment</option>
                                <option>Battery</option>
                                <option>Inverter</option>
                                <option>UPS</option>
                                <option>Solar Panel</option>
                                <option>Stabilizer</option>
                            </select>

                        </div>
                    </div>

                    {/* Priority */}
                    <div>
                        <label className="font-semibold mb-2 block text-sm md:text-base">
                            Priority
                        </label>

                        <div className="flex items-center border rounded-xl px-4 py-3">

                            <AlertTriangle
                                className="text-blue-950 mr-3 flex-shrink-0"
                                size={20}
                            />

                            <select
                                name="priority"
                                value={formData.priority}
                                onChange={handleChange}
                                className="w-full outline-none text-sm md:text-base bg-transparent"
                            >
                                <option>Low</option>
                                <option>Medium</option>
                                <option>High</option>
                                <option>Urgent</option>
                            </select>

                        </div>
                    </div>

                    {/* Service Date */}
                    <div>
                        <label className="font-semibold mb-2 block text-sm md:text-base">
                            Preferred Service Date
                        </label>

                        <div className="flex items-center border rounded-xl px-4 py-3">

                            <Calendar className="text-blue-950 mr-3 flex-shrink-0" size={20} />

                            <input
                                type="date"
                                name="serviceDate"
                                value={formData.serviceDate}
                                onChange={handleChange}
                                className="w-full outline-none text-sm md:text-base"
                            />

                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <label className="font-semibold mb-2 block text-sm md:text-base">
                            Address
                        </label>

                        <div className="flex items-center border rounded-xl px-4 py-3">

                            <MapPin className="text-blue-950 mr-3 flex-shrink-0" size={20} />

                            <input
                                type="text"
                                name="address"
                                placeholder="Enter address"
                                value={formData.address}
                                onChange={handleChange}
                                className="w-full outline-none text-sm md:text-base"
                            />

                        </div>
                    </div>

                    {/* Problem Issue */}
                    <div className="md:col-span-2">

                        <label className="font-semibold mb-2 block text-sm md:text-base">
                            Problem Issue
                        </label>

                        <div className="flex border rounded-xl px-4 py-3">

                            <FileText
                                className="text-blue-950 mr-3 mt-1 flex-shrink-0"
                                size={20}
                            />

                            <textarea
                                name="issue"
                                rows="4"
                                placeholder="Describe the issue..."
                                value={formData.issue}
                                onChange={handleChange}
                                className="w-full outline-none resize-none text-sm md:text-base"
                                required
                            />

                        </div>
                    </div>

                    {/* Additional Notes */}
                    <div className="md:col-span-2">

                        <label className="font-semibold mb-2 block text-sm md:text-base">
                            Additional Description
                        </label>

                        <textarea
                            name="description"
                            rows="3"
                            placeholder="Extra details..."
                            value={formData.description}
                            onChange={handleChange}
                            className="w-full border rounded-xl px-4 py-3 outline-none resize-none text-sm md:text-base"
                        />

                    </div>

                    {/* Submit Button */}
                    <div className="md:col-span-2">

                        <button
                            type="submit"
                            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black py-3 md:py-4 rounded-2xl font-bold text-base md:text-lg flex items-center justify-center gap-3 transition duration-300"
                        >
                            <Send size={22} />

                            Submit Ticket
                        </button>

                    </div>
                </form>
            </div>
        </div>
    );
}