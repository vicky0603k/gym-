/**
 * Project showcase for projects that have no website of their own.
 * Every line here is taken from the project's showcase image — nothing added.
 */
export interface Project {
  slug: string;
  title: string;
  tagline: string;
  summary: string;
  image: string;
  /** Portrait images (posters) are shown narrower than landscape ones. */
  portrait?: boolean;
  tags: string[];
  features: { title: string; detail?: string }[];
  steps?: string[];
  metrics?: { value: string; label: string }[];
}

export const PROJECTS: Project[] = [
  {
    slug: "gym-retention-system",
    title: "Gym Retention System",
    tagline: "Stop losing members silently.",
    summary: "A gym app that tracks attendance and flags members who stop coming, so the gym can reach out before they cancel.",
    image: "/images/projects/gym-retention-system.webp",
    portrait: true,
    tags: ["Gym", "Retention", "Mobile app"],
    features: [
      { title: "QR attendance in seconds" },
      { title: "Red List flags members absent 10+ days" },
      { title: "Call / WhatsApp before they cancel" },
    ],
  },
  {
    slug: "muscleos",
    title: "MuscleOS",
    tagline: "Plan. Train. Track. Grow.",
    summary: "Your personal fitness OS: smart workout plans, progressive overload tracking and nutrition insights — all in one place.",
    image: "/images/projects/muscleos.png",
    tags: ["Fitness", "Dashboard", "AI Coach"],
    features: [
      { title: "Personalized Workout Plans" },
      { title: "Progressive Overload Tracking" },
      { title: "Diet & Nutrition Tracker" },
      { title: "Detailed Analytics" },
      { title: "Smart Reminders" },
      { title: "Workout Builder" },
      { title: "Body Metrics" },
      { title: "AI Coach" },
      { title: "PR Tracking" },
    ],
  },
  {
    slug: "road-accident-detection",
    title: "AI-Based Road Accident Detection",
    tagline: "Detect. Alert. Save lives.",
    summary: "A deep learning system powered by computer vision that detects road accidents in images and videos and alerts authorities and users.",
    image: "/images/projects/road-accident-detection.png",
    tags: ["Deep Learning", "Computer Vision", "CNN / YOLO"],
    features: [
      { title: "Deep Learning", detail: "Powered by computer vision" },
      { title: "Real-Time Detection", detail: "From images & videos" },
      { title: "Instant Alerts", detail: "To authorities & users" },
      { title: "Live Location", detail: "Accident location shown on a map" },
    ],
    steps: ["Input (images / video)", "AI model (CNN / YOLO)", "Accident detection", "Alert (police / users)"],
    metrics: [
      { value: "96.4%", label: "Detection accuracy" },
      { value: "< 2s", label: "Alert time" },
      { value: "Real-time", label: "Monitoring" },
    ],
  },
  {
    slug: "lead-workflow-automation",
    title: "Lead Workflow Automation",
    tagline: "Save time. Get more leads.",
    summary: "Capture, organise and manage leads automatically — from web forms to CRM, with smart routing and notifications.",
    image: "/images/projects/lead-workflow-automation.png",
    tags: ["Automation", "Make", "CRM"],
    features: [
      { title: "Capture Leads", detail: "From website, Meta Ads, landing pages & more" },
      { title: "Automate Workflows", detail: "Route, tag & notify instantly" },
      { title: "Track Performance", detail: "Real-time insights & reports" },
    ],
    steps: [
      "Lead sources: Meta Ads, website forms, landing pages",
      "Make automation engine",
      "Actions: Google Sheets, CRM (TeleCRM / Zoho), WhatsApp message, email confirmation",
      "Hot leads → sales team, follow-up → WhatsApp bot, team notified",
    ],
  },
  {
    slug: "vit-cat-dog-classifier",
    title: "ViT-Based Cat & Dog Classification",
    tagline: "Smarter vision. Better classification.",
    summary: "A deep learning model powered by a Vision Transformer to accurately classify images of cats and dogs.",
    image: "/images/projects/vit-cat-dog-classifier.png",
    tags: ["Vision Transformer", "Deep Learning", "Image Classification"],
    features: [
      { title: "High Accuracy" },
      { title: "ViT Architecture" },
      { title: "Upload & Predict", detail: "Drag and drop an image to get a prediction with its confidence" },
    ],
  },
];

export const getProject = (slug: string) => PROJECTS.find((p) => p.slug === slug);
